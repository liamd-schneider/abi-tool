import { NextResponse } from "next/server";
import { COHORT_COOKIE, findCohort } from "@/lib/cohorts";

/** Login-Link eines Jahrgangs: merkt sich den Jahrgang auf dem Gerät und öffnet den Login */
export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const cohort = await findCohort(slug);
  if (!cohort || !cohort.active) {
    return NextResponse.redirect(new URL("/login?unbekannt=1", request.url));
  }
  const response = NextResponse.redirect(new URL("/login", request.url));
  response.cookies.set(COHORT_COOKIE, cohort.slug, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 400,
  });
  return response;
}
