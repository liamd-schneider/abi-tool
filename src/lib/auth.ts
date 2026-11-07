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
    .select("id, username, full_name, role, calendar_token, admin_tour_done_at, cohort_id")
    .eq("id", userId)
    .maybeSingle();

  return (profile as Profile | null) ?? null;
});

/** Jahrgang + Schule der angemeldeten Person – null, wenn der Jahrgang gesperrt ist. */
export const getCurrentCohort = cache(async (): Promise<CohortInfo | null> => {
  const profile = await getCurrentProfile();
  if (!profile) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("cohorts")
    .select("id, name, grad_year, slug, join_code, active, schools(id, name, city)")
    .eq("id", profile.cohort_id)
    .maybeSingle();
  return (data as unknown as CohortInfo | null) ?? null;
});

export const isPlatformAdmin = cache(async (): Promise<boolean> => {
  const profile = await getCurrentProfile();
  if (!profile) return false;
  const supabase = await createClient();
  const { data } = await supabase.from("platform_admins").select("user_id").eq("user_id", profile.id).maybeSingle();
  return Boolean(data);
});

export async function requireUser(): Promise<Profile> {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  return profile;
}

export async function requireAdmin(): Promise<Profile> {
  const profile = await requireUser();
  if (profile.role !== "admin") redirect("/start");
  return profile;
}

export async function requirePlatformAdmin(): Promise<Profile> {
  const profile = await requireUser();
  if (!(await isPlatformAdmin())) redirect("/start");
  return profile;
}

/**
 * Login per Benutzername: intern wird daraus eine (nie benutzte) E-Mail-Adresse.
 * Jeder Jahrgang hat eine eigene Domain, damit "max.mustermann" an mehreren Schulen existieren kann.
 */
export function usernameToEmail(username: string, emailDomain: string) {
  return `${username}@${emailDomain}`;
}
