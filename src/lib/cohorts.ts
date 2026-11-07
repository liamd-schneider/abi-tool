import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { slugPart } from "@/lib/usernames";

/** Cookie, in dem sich das Gerät den Jahrgang für den Login merkt */
export const COHORT_COOKIE = "abi_cohort";

export interface CohortLookup {
  id: string;
  name: string;
  slug: string;
  email_domain: string;
  active: boolean;
  schools: { name: string; city: string | null } | null;
}

const LOOKUP_FIELDS = "id, name, slug, email_domain, active, schools(name, city)";

/** Jahrgang über Login-Link-Slug oder Jahrgangs-Code finden (serverseitig, mit Secret Key) */
export async function findCohort(ref: string | null | undefined): Promise<CohortLookup | null> {
  const value = (ref ?? "").trim();
  if (!value) return null;
  const admin = createAdminClient();
  const code = value.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const slug = value.toLowerCase();

  if (/^[a-z0-9][a-z0-9-]{1,62}$/.test(slug)) {
    const { data } = await admin.from("cohorts").select(LOOKUP_FIELDS).eq("slug", slug).maybeSingle();
    if (data) return data as unknown as CohortLookup;
  }
  if (/^[A-Z0-9]{6,12}$/.test(code)) {
    const { data } = await admin.from("cohorts").select(LOOKUP_FIELDS).eq("join_code", code).maybeSingle();
    if (data) return data as unknown as CohortLookup;
  }
  return null;
}

export { cohortLabel } from "@/lib/cohort-label";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** Gut abtippbarer Jahrgangs-Code ohne verwechselbare Zeichen */
export function generateJoinCode(length = 8) {
  const bytes = new Uint32Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join("");
}

/** z. B. "gymnasium-musterstadt-2027" – eindeutig gemacht mit Zahl-Suffix */
export async function uniqueCohortSlug(schoolName: string, city: string | null, year: number | null) {
  const base =
    [slugPart(schoolName), city ? slugPart(city) : "", year ? String(year) : ""]
      .filter(Boolean)
      .join("-")
      .replace(/-+/g, "-")
      .slice(0, 50)
      .replace(/-+$/, "") || "jahrgang";
  const admin = createAdminClient();
  const { data } = await admin.from("cohorts").select("slug").like("slug", `${base}%`);
  const taken = new Set((data ?? []).map((r) => r.slug as string));
  if (!taken.has(base)) return base;
  for (let i = 2; ; i++) if (!taken.has(`${base}-${i}`)) return `${base}-${i}`;
}

/** Interne Login-Domain eines neuen Jahrgangs (es werden nie E-Mails verschickt) */
export function emailDomainFor(slug: string) {
  const root = process.env.AUTH_USERNAME_EMAIL_DOMAIN || "abi.local";
  return `${slug}.${root}`;
}
