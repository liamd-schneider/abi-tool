import "server-only";
import { createClient as createPlainClient } from "@supabase/supabase-js";
import { getCurrentProfile } from "@/lib/auth";
import { hitRateLimit } from "@/lib/security/rate-limit";
import { createClient } from "@/lib/supabase/server";

/**
 * Passwort der angemeldeten Person erneut prüfen – für gefährliche Aktionen wie
 * "Account löschen" oder "Jahrgang löschen". Die aktuelle Sitzung bleibt unberührt.
 * Bewusst KEINE Server Action (sonst wäre es ein öffentlich aufrufbarer Passwort-Tester).
 */
export async function verifyOwnPassword(password: string): Promise<boolean> {
  const me = await getCurrentProfile();
  if (!me || !password || password.length > 200) return false;
  if (!(await hitRateLimit("reauth", me.id, 10, 15 * 60))) return false;

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const email = data.user?.email;
  if (!email) return false;

  const probe = createPlainClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { error } = await probe.auth.signInWithPassword({ email, password });
  if (!error) await probe.auth.signOut({ scope: "local" });
  return !error;
}
