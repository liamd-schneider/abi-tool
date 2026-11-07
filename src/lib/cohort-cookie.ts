import "server-only";
import { cookies } from "next/headers";
import { COHORT_COOKIE } from "@/lib/cohorts";

/** Jahrgang auf diesem Gerät merken (für den nächsten Login) – nur serverseitig */
export async function rememberCohort(slug: string) {
  (await cookies()).set(COHORT_COOKIE, slug, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 400,
  });
}
