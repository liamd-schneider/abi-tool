import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { CohortInfo, Profile } from "@/lib/types";

/** Aktuelles Profil (oder null). Pro Request nur einmal geladen. */
export const getCurrentProfile = cache(async (): Promise<Profile | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, username, full_name, role, admin_tour_done_at, cohort_id")
    .eq("id", userId)
    .maybeSingle();

  return (profile as Profile | null) ?? null;
});

/** Jahrgang + Schule der angemeldeten Person – null, wenn der Jahrgang gesperrt ist oder noch freigeschaltet werden muss. */
export const getCurrentCohort = cache(async (): Promise<CohortInfo | null> => {
  const profile = await getCurrentProfile();
  if (!profile) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("cohorts")
    .select("id, name, grad_year, slug, join_code, active, pending, require_admin_2fa, schools(id, name, city)")
    .eq("id", profile.cohort_id)
    .maybeSingle();
  return (data as unknown as CohortInfo | null) ?? null;
});

/** Zwei-Faktor-Stand der Sitzung: current = jetzt, next = möglich (aal2 = 2FA eingerichtet) */
export const getAal = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  return { current: data?.currentLevel ?? null, next: data?.nextLevel ?? null };
});

export const isPlatformAdmin = cache(async (): Promise<boolean> => {
  const profile = await getCurrentProfile();
  if (!profile) return false;
  const supabase = await createClient();
  // Die eigene Zeile ist auch ohne 2FA lesbar – die Plattform-Rechte selbst gibt es nur mit 2FA
  const { data } = await supabase.from("platform_admins").select("user_id").eq("user_id", profile.id).maybeSingle();
  return Boolean(data);
});

export async function requireUser(): Promise<Profile> {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  // Wer 2FA eingerichtet hat, muss den Code auch eingeben
  const aal = await getAal();
  if (aal.next === "aal2" && aal.current !== "aal2") redirect("/login/2fa");
  return profile;
}

export async function requireAdmin(): Promise<Profile> {
  const profile = await requireUser();
  if (profile.role !== "admin") redirect("/start");
  const cohort = await getCurrentCohort();
  if (cohort?.require_admin_2fa && (await getAal()).current !== "aal2") redirect("/profil?zweifaktor=admin");
  return profile;
}

export async function requirePlatformAdmin(): Promise<Profile> {
  const profile = await requireUser();
  if (!(await isPlatformAdmin())) redirect("/start");
  const aal = await getAal();
  if (aal.current !== "aal2") redirect(aal.next === "aal2" ? "/login/2fa?next=/plattform" : "/profil?zweifaktor=plattform");
  return profile;
}

/**
 * Login per Benutzername: intern wird daraus eine (nie benutzte) E-Mail-Adresse.
 * Jeder Jahrgang hat eine eigene Domain, damit "max.mustermann" an mehreren Schulen existieren kann.
 */
export function usernameToEmail(username: string, emailDomain: string) {
  return `${username}@${emailDomain}`;
}
