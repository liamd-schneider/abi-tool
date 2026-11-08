import { getCurrentCohort } from "@/lib/auth";
import { rememberCohort } from "@/lib/cohort-cookie";
import { isSameOrigin } from "@/lib/security/request-guard";

/**
 * Merkt sich auf diesem Gerät den Jahrgang des eingeloggten Accounts (für den nächsten Login).
 * Wichtig für alle, die schon vor der Mehrschulen-Umstellung eingeloggt waren: So brauchen sie
 * auch dann keinen Jahrgangs-Code, wenn es ihren Benutzernamen später an einer anderen Schule gibt.
 */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return new Response(null, { status: 403 });
  const cohort = await getCurrentCohort();
  if (!cohort) return new Response(null, { status: 204 });
  await rememberCohort(cohort.slug);
  return new Response(null, { status: 204 });
}
