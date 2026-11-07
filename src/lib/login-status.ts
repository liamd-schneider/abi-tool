import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * user_id → Zeitpunkt des letzten Logins mit Passwort (null = noch nie eingeloggt).
 * Kommt aus Supabase Auth und braucht den Secret Key – nur auf Admin-Seiten nach requireAdmin() verwenden!
 * Hinweis: Wer eingeloggt bleibt, meldet sich nicht neu an – das Datum ist also der letzte Login, nicht die letzte Nutzung.
 */
export async function loadLastSignIns(): Promise<Map<string, string | null>> {
  const admin = createAdminClient();
  const result = new Map<string, string | null>();
  const perPage = 1000;
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(`Login-Status konnte nicht geladen werden: ${error.message}`);
    for (const user of data.users) result.set(user.id, user.last_sign_in_at ?? null);
    if (data.users.length < perPage) break;
  }
  return result;
}
