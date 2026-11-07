import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Login-Cookies sind httpOnly: Die App spricht Supabase ausschließlich serverseitig an,
 * also muss (und darf) kein Browser-Skript die Tokens lesen können.
 */
export const AUTH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};

/** Supabase-Client für Server Components, Server Actions und Route Handler (mit Login-Cookies, RLS greift). */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookieOptions: AUTH_COOKIE_OPTIONS,
      auth: { experimental: { recoveryCodes: true } },
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // In Server Components dürfen keine Cookies gesetzt werden – der Proxy erneuert die Session.
          }
        },
      },
    },
  );
}
