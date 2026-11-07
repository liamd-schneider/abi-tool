"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireUser, usernameToEmail } from "@/lib/auth";
import { COHORT_COOKIE, findCohort, type CohortLookup } from "@/lib/cohorts";
import { str } from "@/lib/forms";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { ActionState } from "@/lib/types";
import { normalizeUsernameInput } from "@/lib/usernames";

export type LoginState = ActionState<{ needCode?: boolean }>;

/** Jahrgang auf diesem Gerät merken (für den nächsten Login) */
export async function rememberCohort(slug: string) {
  (await cookies()).set(COHORT_COOKIE, slug, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 400,
  });
}

export async function forgetCohort() {
  (await cookies()).delete(COHORT_COOKIE);
}

export async function login(_prev: LoginState, fd: FormData): Promise<LoginState> {
  const username = normalizeUsernameInput(str(fd, "username"));
  const password = String(fd.get("password") ?? "");
  const cohortRef = str(fd, "cohort");
  if (!username || !password) return { error: "Bitte Benutzername und Passwort eingeben." };

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

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: usernameToEmail(username, cohort.email_domain),
    password,
  });
  if (error) {
    return {
      error: error.status === 429 ? "Zu viele Versuche – bitte kurz warten." : "Benutzername oder Passwort ist falsch.",
      data: cohortRef ? { needCode: true } : undefined,
    };
  }

  await rememberCohort(cohort.slug);
  const next = str(fd, "next");
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/start");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function changePassword(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireUser();
  const password = String(fd.get("password") ?? "");
  const confirm = String(fd.get("confirm") ?? "");
  if (password.length < 8) return { error: "Das Passwort muss mindestens 8 Zeichen haben." };
  if (password !== confirm) return { error: "Die Passwörter stimmen nicht überein." };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    if (error.code === "same_password") return { error: "Das ist schon dein aktuelles Passwort." };
    if (error.code === "weak_password") return { error: "Das Passwort ist zu schwach." };
    return { error: `Fehler: ${error.message}` };
  }
  return { ok: true, message: "Passwort geändert." };
}
