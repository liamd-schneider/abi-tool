import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

/** Aktuelles Profil (oder null). Pro Request nur einmal geladen. */
export const getCurrentProfile = cache(async (): Promise<Profile | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, username, full_name, role, calendar_token, admin_tour_done_at")
    .eq("id", userId)
    .maybeSingle();

  return (profile as Profile | null) ?? null;
});

export async function requireUser(): Promise<Profile> {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  return profile;
}

export async function requireAdmin(): Promise<Profile> {
  const profile = await requireUser();
  if (profile.role !== "admin") redirect("/");
  return profile;
}

/** Login per Benutzername: intern wird daraus eine (nie benutzte) E-Mail-Adresse. */
export function usernameToEmail(username: string) {
  const domain = process.env.AUTH_USERNAME_EMAIL_DOMAIN || "abi.local";
  return `${username}@${domain}`;
}
