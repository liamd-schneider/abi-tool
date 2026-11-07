import "server-only";
import { getCurrentProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Sicherheitsrelevante Aktionen protokollieren (wer, wann, was).
 * Sichtbar für Admins des Jahrgangs und Plattform-Admins. Fehler hier brechen nie die eigentliche Aktion ab.
 */
export async function audit(
  action: string,
  opts: {
    target?: string | null;
    details?: Record<string, unknown>;
    cohortId?: string | null;
    actor?: { id: string; full_name: string } | null;
  } = {},
) {
  try {
    const actor = opts.actor === undefined ? await getCurrentProfile() : opts.actor;
    const cohortId = opts.cohortId !== undefined ? opts.cohortId : ((actor as { cohort_id?: string } | null)?.cohort_id ?? null);
    await createAdminClient()
      .from("audit_log")
      .insert({
        cohort_id: cohortId,
        actor_id: actor?.id ?? null,
        actor_name: actor?.full_name?.slice(0, 160) ?? null,
        action: action.slice(0, 80),
        target: opts.target?.slice(0, 300) ?? null,
        details: opts.details ?? null,
      });
  } catch (error) {
    console.error("Audit-Log fehlgeschlagen", action, error);
  }
}

export const AUDIT_LABELS: Record<string, string> = {
  "members.created": "Accounts angelegt",
  "member.password_reset": "Passwort zurückgesetzt",
  "member.role_changed": "Rolle geändert",
  "member.renamed": "Name geändert",
  "member.deleted": "Account gelöscht",
  "member.mfa_reset": "2FA zurückgesetzt",
  "event.published": "Termin veröffentlicht",
  "event.unpublished": "Termin zurückgezogen",
  "event.deleted": "Termin gelöscht",
  "organizer.set": "Orga-Team geändert",
  "organizer.removed": "Aus Orga-Team entfernt",
  "cohort.settings": "Jahrgang bearbeitet",
  "cohort.join_code": "Jahrgangs-Code erneuert",
  "cohort.require_2fa": "2FA-Pflicht für Admins geändert",
  "cohort.registered": "Jahrgang registriert",
  "cohort.deleted": "Jahrgang gelöscht",
  "cohort.locked": "Jahrgang gesperrt",
  "cohort.unlocked": "Jahrgang freigeschaltet",
  "cohort.approved": "Jahrgang freigegeben",
  "partner.saved": "Partner gespeichert",
  "partner.deleted": "Partner gelöscht",
  "account.password_changed": "Eigenes Passwort geändert",
  "account.mfa_enabled": "2FA aktiviert",
  "account.mfa_disabled": "2FA deaktiviert",
  "account.recovery_codes": "Wiederherstellungscodes erzeugt",
  "account.logout_all": "Auf allen Geräten abgemeldet",
  "account.data_export": "Eigene Daten heruntergeladen",
  "account.deleted": "Eigenen Account gelöscht",
  "login.blocked": "Login blockiert (zu viele Versuche)",
};
