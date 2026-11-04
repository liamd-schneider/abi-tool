import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Supabase-Client mit Secret Key – umgeht RLS!
 * Nur serverseitig und nur nach requireAdmin()/eigener Prüfung verwenden.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!key) throw new Error("SUPABASE_SECRET_KEY fehlt in den Umgebungsvariablen.");

  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
