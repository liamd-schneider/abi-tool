"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { audit } from "@/lib/audit";
import { requireUser, usernameToEmail } from "@/lib/auth";
import { rememberCohort } from "@/lib/cohort-cookie";
import { COHORT_COOKIE, findCohort, type CohortLookup } from "@/lib/cohorts";
import { str } from "@/lib/forms";
import { safeNextPath } from "@/lib/safe-path";
import { checkNewPassword } from "@/lib/security/password";
import { clearRateLimit, clientIp, hitRateLimit, recordRateLimit, underRateLimit } from "@/lib/security/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { ActionState } from "@/lib/types";
import { normalizeUsernameInput } from "@/lib/usernames";

export type LoginState = ActionState<{ needCode?: boolean }>;

// Fehlversuche pro Account: 8 in 15 Minuten; Anfragen pro IP: 40 in 15 Minuten
const ACCOUNT_LIMIT = 8;
const IP_LIMIT = 40;
const WINDOW = 15 * 60;

export async function forgetCohort() {
  (await cookies()).delete(COHORT_COOKIE);
}

export async function login(_prev: LoginState, fd: FormData): Promise<LoginState> {
  const username = normalizeUsernameInput(str(fd, "username")).slice(0, 80);
  const password = String(fd.get("password") ?? "").slice(0, 200);
  const cohortRef = str(fd, "cohort").slice(0, 80);
  if (!username || !password) return { error: "Bitte Benutzername und Passwort eingeben." };

  const ip = await clientIp();
  if (!(await hitRateLimit("login-ip", ip, IP_LIMIT, WINDOW))) {
    return { error: "Zu viele Anmeldeversuche von diesem Gerät. Bitte warte 15 Minuten." };
  }

  let cohort: CohortLookup | null = null;
  if (cohortRef) {
    cohort = await findCohort(cohortRef);
    if (!cohort) return { error: "Diesen Jahrgangs-Code kennen wir nicht.", data: { needCode: true } };
  } else {
    // Ohne Code: Ist der Benutzername eindeutig, ergibt sich der Jahrgang von selbst
    const admin = createAdminClient();
    const { data: matches } = await admin.from("profiles").select("cohort_id").eq("username", username).limit(2);
    if (!matches?.length) return { error: "Benutzername oder Passwort ist falsch." };
    if (matches.length > 1) {
      return {
        error: "Diesen Benutzernamen gibt es an mehreren Schulen – bitte gib euren Jahrgangs-Code ein.",
        data: { needCode: true },
      };
    }
    const { data } = await admin
      .from("cohorts")
      .select("id, name, slug, email_domain, active, schools(name, city)")
      .eq("id", matches[0].cohort_id)
      .maybeSingle();
    cohort = (data as unknown as CohortLookup | null) ?? null;
  }

  if (!cohort) return { error: "Benutzername oder Passwort ist falsch." };
  if (!cohort.active) return { error: "Dieser Jahrgang ist gesperrt. Bitte wende dich an euer Abikomitee." };

  // Brute-Force-Schutz pro Account
  const accountKey = `${cohort.id}:${username}`;
  if (!(await underRateLimit("login-fail", accountKey, ACCOUNT_LIMIT, WINDOW))) {
    await audit("login.blocked", { actor: null, cohortId: cohort.id, target: username });
    return { error: "Zu viele Fehlversuche für diesen Account. Bitte warte 15 Minuten oder frag euer Abikomitee." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: usernameToEmail(username, cohort.email_domain),
    password,
  });
  if (error) {
    await recordRateLimit("login-fail", accountKey);
    return {
      error: error.status === 429 ? "Zu viele Versuche – bitte kurz warten." : "Benutzername oder Passwort ist falsch.",
      data: cohortRef ? { needCode: true } : undefined,
    };
  }

  await clearRateLimit("login-fail", accountKey);
  await rememberCohort(cohort.slug);
  const next = safeNextPath(str(fd, "next"));

  // 2FA eingerichtet? (aus der Datenbank, nicht aus dem Cookie) Dann erst noch den Code abfragen
  const { data: mfaEnabled } = await supabase.rpc("my_mfa_enabled");
  if (mfaEnabled === true) redirect(`/login/2fa?next=${encodeURIComponent(next)}`);
  redirect(next);
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function changePassword(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireUser();
  const password = String(fd.get("password") ?? "");
  const confirm = String(fd.get("confirm") ?? "");
  if (password !== confirm) return { error: "Die Passwörter stimmen nicht überein." };
  const weak = await checkNewPassword(password, [me.full_name, me.username]);
  if (weak) return { error: weak };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    if (error.code === "same_password") return { error: "Das ist schon dein aktuelles Passwort." };
    if (error.code === "weak_password") return { error: "Das Passwort ist zu schwach." };
    if (error.code === "insufficient_aal") return { error: "Bitte melde dich zuerst mit deinem 2FA-Code an." };
    console.error("Passwortänderung", error);
    return { error: "Das Passwort konnte nicht geändert werden. Bitte versuch es nochmal." };
  }
  // Alle anderen Geräte abmelden – falls jemand das alte Passwort kannte
  await supabase.auth.signOut({ scope: "others" });
  await audit("account.password_changed");
  return { ok: true, message: "Passwort geändert – alle anderen Geräte wurden abgemeldet." };
}
