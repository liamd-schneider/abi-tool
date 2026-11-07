"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { audit } from "@/lib/audit";
import { getCurrentCohort, getCurrentProfile, isPlatformAdmin, requireUser } from "@/lib/auth";
import { COHORT_COOKIE } from "@/lib/cohorts";
import { str } from "@/lib/forms";
import { safeNextPath } from "@/lib/safe-path";
import { hitRateLimit } from "@/lib/security/rate-limit";
import { verifyOwnPassword } from "@/lib/security/reauth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { ActionState } from "@/lib/types";

// =================================================================== 2FA beim Login

export async function verifySecondFactor(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const me = await getCurrentProfile();
  if (!me) redirect("/login");
  if (!(await hitRateLimit("mfa-verify", me.id, 10, 15 * 60))) {
    return { error: "Zu viele Versuche. Bitte warte 15 Minuten." };
  }

  const code = str(fd, "code").replace(/\s+/g, "");
  const useRecovery = fd.get("mode") === "recovery";
  const supabase = await createClient();

  if (useRecovery) {
    const { error } = await supabase.auth.mfa.recoveryCodes.verify({ code });
    if (error) {
      return { error: error.code === "mfa_recovery_codes_locked" ? "Zu viele Versuche – bitte warte etwas." : "Dieser Code passt nicht." };
    }
  } else {
    if (!/^\d{6}$/.test(code)) return { error: "Bitte den 6-stelligen Code aus deiner Authenticator-App eingeben." };
    const { data: factors } = await supabase.auth.mfa.listFactors();
    const totp = factors?.totp?.[0];
    if (!totp) return { error: "Keine Authenticator-App eingerichtet." };
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: totp.id, code });
    if (error) return { error: "Der Code passt nicht. Achte darauf, dass die Uhrzeit auf deinem Handy stimmt." };
  }

  redirect(safeNextPath(str(fd, "next")));
}

// =================================================================== 2FA einrichten

export interface TotpEnrollment {
  factorId: string;
  qr: string;
  secret: string;
}

export async function startTotpEnrollment(): Promise<ActionState<TotpEnrollment>> {
  await requireUser();
  const supabase = await createClient();

  // Halbfertige Versuche aufräumen
  const { data: factors } = await supabase.auth.mfa.listFactors();
  for (const f of factors?.all ?? []) {
    if (f.factor_type === "totp" && f.status !== "verified") await supabase.auth.mfa.unenroll({ factorId: f.id });
  }
  if (factors?.totp?.length) return { error: "Die Zwei-Faktor-Anmeldung ist schon eingerichtet." };

  const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: "Authenticator-App", issuer: "Abi-Tool" });
  if (error || !data) {
    console.error("MFA enroll", error);
    return { error: "Die Einrichtung konnte nicht gestartet werden. Bitte versuch es nochmal." };
  }
  return { ok: true, data: { factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret } };
}

export async function confirmTotpEnrollment(factorId: string, code: string): Promise<ActionState<{ recoveryCodes: string[] | null }>> {
  const me = await requireUser();
  if (!(await hitRateLimit("mfa-enroll", me.id, 10, 15 * 60))) return { error: "Zu viele Versuche. Bitte warte 15 Minuten." };
  if (!/^\d{6}$/.test(code.replace(/\s+/g, ""))) return { error: "Bitte den 6-stelligen Code eingeben." };

  const supabase = await createClient();
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: code.replace(/\s+/g, "") });
  if (error) return { error: "Der Code passt nicht. Prüf, ob die Uhrzeit auf deinem Handy stimmt, und versuch es nochmal." };

  // Wiederherstellungscodes (falls auf dem Server freigeschaltet)
  let recoveryCodes: string[] | null = null;
  const generated = await supabase.auth.mfa.recoveryCodes.generate({ friendlyName: "Wiederherstellungscodes" });
  if (!generated.error && generated.data) recoveryCodes = generated.data.codes;

  await audit("account.mfa_enabled", { details: { recoveryCodes: Boolean(recoveryCodes) } });
  revalidatePath("/", "layout");
  return { ok: true, message: "Zwei-Faktor-Anmeldung ist aktiv.", data: { recoveryCodes } };
}

export async function regenerateRecoveryCodes(): Promise<ActionState<{ recoveryCodes: string[] }>> {
  await requireUser();
  const supabase = await createClient();
  const result = await supabase.auth.mfa.recoveryCodes.regenerate();
  if (result.error || !result.data) {
    const generated = await supabase.auth.mfa.recoveryCodes.generate({ friendlyName: "Wiederherstellungscodes" });
    if (generated.error || !generated.data) {
      return { error: "Wiederherstellungscodes sind auf dem Server nicht verfügbar. Im Notfall kann ein Admin deine 2FA zurücksetzen." };
    }
    await audit("account.recovery_codes");
    return { ok: true, data: { recoveryCodes: generated.data.codes } };
  }
  await audit("account.recovery_codes");
  return { ok: true, data: { recoveryCodes: result.data.codes } };
}

export async function disableTotp(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireUser();
  if (!(await verifyOwnPassword(String(fd.get("password") ?? "")))) return { error: "Das Passwort stimmt nicht." };

  // Für Plattform-Admins und Admins mit 2FA-Pflicht nicht abschaltbar
  if (await isPlatformAdmin()) return { error: "Für Plattform-Admins ist die Zwei-Faktor-Anmeldung Pflicht." };
  const cohort = await getCurrentCohort();
  if (me.role === "admin" && cohort?.require_admin_2fa) {
    return { error: "Euer Jahrgang verlangt 2FA für Admins – deshalb kannst du sie nicht abschalten." };
  }

  const supabase = await createClient();
  const { data: factors } = await supabase.auth.mfa.listFactors();
  for (const f of factors?.all ?? []) {
    const { error } = await supabase.auth.mfa.unenroll({ factorId: f.id });
    if (error) {
      console.error("MFA unenroll", error);
      return { error: "Bitte melde dich zuerst mit deinem 2FA-Code an." };
    }
  }
  await audit("account.mfa_disabled");
  revalidatePath("/", "layout");
  return { ok: true, message: "Zwei-Faktor-Anmeldung ausgeschaltet." };
}

// =================================================================== Sitzungen & Account

export async function logoutEverywhere() {
  await requireUser();
  await audit("account.logout_all");
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "global" });
  redirect("/login");
}

export async function deleteOwnAccount(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireUser();
  if (str(fd, "confirm") !== "LÖSCHEN") return { error: "Bitte zur Bestätigung LÖSCHEN eintippen." };
  if (!(await verifyOwnPassword(String(fd.get("password") ?? "")))) return { error: "Das Passwort stimmt nicht." };

  const admin = createAdminClient();
  if (me.role === "admin") {
    const { count } = await admin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("cohort_id", me.cohort_id)
      .eq("role", "admin");
    if ((count ?? 0) <= 1) {
      return { error: "Du bist der letzte Admin. Ernenne zuerst jemand anderen zum Admin oder lösche den ganzen Jahrgang." };
    }
  }

  await audit("account.deleted", { target: me.username });
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "global" });
  const { error } = await admin.auth.admin.deleteUser(me.id);
  if (error) {
    console.error("Account löschen", error);
    return { error: "Der Account konnte nicht gelöscht werden. Bitte wende dich an euer Abikomitee." };
  }
  (await cookies()).delete(COHORT_COOKIE);
  redirect("/?account-geloescht=1");
}
