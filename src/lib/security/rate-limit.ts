import "server-only";
import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";

// Rate-Limits liegen in der Datenbank (funktioniert auch über mehrere Vercel-Instanzen hinweg).
// Gespeichert wird nie die IP oder der Benutzername selbst, sondern ein gesalzener Hash.

function salt() {
  return process.env.RATE_LIMIT_SALT || process.env.CRON_SECRET || "abi-tool";
}

export function hashKey(...parts: string[]) {
  return createHash("sha256").update([salt(), ...parts].join("|")).digest("base64url").slice(0, 32);
}

/** Öffentliche IP des Besuchers (Vercel setzt x-real-ip / x-forwarded-for vertrauenswürdig) */
export async function clientIp(): Promise<string> {
  const h = await headers();
  const ip = h.get("x-real-ip") || h.get("x-forwarded-for")?.split(",")[0]?.trim() || "unbekannt";
  return ip.slice(0, 64);
}

const key = (scope: string, id: string) => `${scope}:${hashKey(scope, id)}`;

/** Zählt den Versuch und sagt, ob er erlaubt ist (true) oder das Limit erreicht wurde (false) */
export async function hitRateLimit(scope: string, id: string, limit: number, windowSeconds: number) {
  const { data, error } = await createAdminClient().rpc("hit_rate_limit", {
    p_key: key(scope, id),
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });
  if (error) {
    console.error("Rate-Limit nicht prüfbar", error.message);
    return true; // Datenbankfehler sollen niemanden aussperren
  }
  return data === true;
}

/** Nur prüfen, nicht zählen (z. B. fehlgeschlagene Logins pro Account) */
export async function underRateLimit(scope: string, id: string, limit: number, windowSeconds: number) {
  const { data, error } = await createAdminClient().rpc("rate_limit_ok", {
    p_key: key(scope, id),
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });
  if (error) {
    console.error("Rate-Limit nicht prüfbar", error.message);
    return true;
  }
  return data === true;
}

export async function recordRateLimit(scope: string, id: string) {
  await createAdminClient().rpc("rate_limit_record", { p_key: key(scope, id) });
}

export async function clearRateLimit(scope: string, id: string) {
  await createAdminClient().rpc("rate_limit_clear", { p_key: key(scope, id) });
}
