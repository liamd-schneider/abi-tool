"use server";

// Aktionen, die ausschließlich Admins dürfen.
// (Alles, was einen einzelnen Termin betrifft und auch das Orga-Team darf, liegt in ./event.ts)

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { audit } from "@/lib/audit";
import { getAal, requireAdmin, usernameToEmail } from "@/lib/auth";
import { COHORT_COOKIE, generateJoinCode } from "@/lib/cohorts";
import { fromLocalInput } from "@/lib/dates";
import { isEventPermission } from "@/lib/event-permissions";
import { bool, dbError, optStr, str } from "@/lib/forms";
import { refreshAll as refresh } from "@/lib/refresh";
import { verifyOwnPassword } from "@/lib/security/reauth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { ActionState, Role } from "@/lib/types";
import { generatePassword, makeUsername, parseNameLine } from "@/lib/usernames";

/** Person aus dem eigenen Jahrgang laden (Secret Key umgeht RLS – darum immer explizit prüfen) */
async function memberOfMyCohort(cohortId: string, userId: string) {
  const { data } = await createAdminClient()
    .from("profiles")
    .select("id, username, full_name, role")
    .eq("id", userId)
    .eq("cohort_id", cohortId)
    .maybeSingle();
  return data as { id: string; username: string; full_name: string; role: Role } | null;
}

async function revokeSessions(userId: string) {
  const { data, error } = await createAdminClient().rpc("revoke_user_sessions", { p_user_id: userId });
  if (error || data === false) console.error("Sitzungen nicht beendet", error);
}

// =================================================================== Termine

export async function setEventPublished(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  const published = bool(fd, "published");
  const supabase = await createClient();
  const { data, error } = await supabase.from("events").update({ published }).eq("id", str(fd, "id")).select("title").maybeSingle();
  if (error) return dbError(error);
  await audit(published ? "event.published" : "event.unpublished", { target: data?.title });
  refresh();
  return { ok: true, message: published ? "Termin veröffentlicht – alle wurden benachrichtigt." : "Termin ist wieder Entwurf." };
}

export async function deleteEvent(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase.from("events").delete().eq("id", str(fd, "id")).select("title").maybeSingle();
  if (error) return dbError(error);
  await audit("event.deleted", { target: data?.title });
  refresh();
  redirect("/admin/termine");
}

// =================================================================== Orga-Team

export async function setOrganizer(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireAdmin();
  const eventId = str(fd, "event_id");
  const userId = str(fd, "user_id");
  if (!userId) return { error: "Bitte eine Person auswählen." };
  const person = await memberOfMyCohort(me.cohort_id, userId);
  if (!person) return { error: "Person nicht gefunden." };
  const permissions = [...new Set(fd.getAll("permission").filter(isEventPermission))];

  const supabase = await createClient();
  const { error } = await supabase
    .from("event_organizers")
    .upsert({ event_id: eventId, user_id: userId, permissions }, { onConflict: "event_id,user_id" });
  if (error) return dbError(error);
  await audit("organizer.set", { target: person.full_name, details: { event_id: eventId, permissions } });
  refresh();
  return { ok: true, message: fd.has("is_update") ? "Rechte gespeichert." : "Zum Orga-Team hinzugefügt – Person wurde benachrichtigt." };
}

export async function removeOrganizer(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireAdmin();
  const userId = str(fd, "user_id");
  const supabase = await createClient();
  const { error } = await supabase.from("event_organizers").delete().eq("event_id", str(fd, "event_id")).eq("user_id", userId);
  if (error) return dbError(error);
  const person = await memberOfMyCohort(me.cohort_id, userId);
  await audit("organizer.removed", { target: person?.full_name, details: { event_id: str(fd, "event_id") } });
  refresh();
  return { ok: true, message: "Aus dem Orga-Team entfernt." };
}

// =================================================================== Mitglieder

export interface CreatedAccount {
  full_name: string;
  username: string;
  password: string;
}

export async function createMembers(
  _prev: ActionState<{ created: CreatedAccount[]; errors: string[] }>,
  fd: FormData,
): Promise<ActionState<{ created: CreatedAccount[]; errors: string[] }>> {
  const me = await requireAdmin();
  const lines = str(fd, "names")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const role: Role = str(fd, "role") === "admin" ? "admin" : "member";
  if (lines.length === 0) return { error: "Bitte mindestens einen Namen eintragen." };
  if (lines.length > 200) return { error: "Maximal 200 Namen auf einmal." };

  const admin = createAdminClient();
  const { data: cohort } = await admin.from("cohorts").select("id, email_domain").eq("id", me.cohort_id).single();
  if (!cohort) return { error: "Jahrgang nicht gefunden." };
  // Benutzernamen müssen nur innerhalb des eigenen Jahrgangs eindeutig sein
  const { data: existing, error: loadError } = await admin
    .from("profiles")
    .select("username, full_name")
    .eq("cohort_id", cohort.id);
  if (loadError) return dbError(loadError);

  const taken = new Map((existing ?? []).map((p) => [p.username, p.full_name.toLowerCase()]));
  const created: CreatedAccount[] = [];
  const errors: string[] = [];

  for (const line of lines) {
    const parsed = parseNameLine(line.slice(0, 160));
    if (!parsed) {
      errors.push(`„${line.slice(0, 60)}“: bitte Vor- und Nachname angeben.`);
      continue;
    }
    const base = makeUsername(parsed.first, parsed.last).slice(0, 60);
    if (base.length < 3 || base.startsWith(".") || base.endsWith(".")) {
      errors.push(`„${line.slice(0, 60)}“: daraus lässt sich kein Benutzername bilden.`);
      continue;
    }
    if (taken.get(base) === parsed.full.toLowerCase()) {
      errors.push(`${parsed.full} hat schon einen Account (${base}).`);
      continue;
    }

    let username = base;
    for (let i = 2; taken.has(username); i++) username = `${base}${i}`;

    const password = generatePassword(12);
    const { data, error } = await admin.auth.admin.createUser({
      email: usernameToEmail(username, cohort.email_domain),
      password,
      email_confirm: true,
      app_metadata: { username },
      user_metadata: { full_name: parsed.full },
    });
    if (error || !data.user) {
      console.error("createUser", error);
      errors.push(`${parsed.full}: Account konnte nicht angelegt werden.`);
      continue;
    }

    const { error: profileError } = await admin
      .from("profiles")
      .insert({ id: data.user.id, username, full_name: parsed.full, role, cohort_id: cohort.id });
    if (profileError) {
      console.error("Profil anlegen", profileError);
      await admin.auth.admin.deleteUser(data.user.id);
      errors.push(`${parsed.full}: Account konnte nicht angelegt werden.`);
      continue;
    }

    taken.set(username, parsed.full.toLowerCase());
    created.push({ full_name: parsed.full, username, password });
  }

  if (created.length) {
    await audit("members.created", { details: { count: created.length, role, usernames: created.map((c) => c.username) } });
  }
  refresh();
  return {
    ok: created.length > 0,
    message: created.length ? `${created.length} Account(s) angelegt.` : undefined,
    error: created.length === 0 ? "Es wurde kein Account angelegt." : undefined,
    data: { created, errors },
  };
}

export async function resetPassword(
  _prev: ActionState<CreatedAccount>,
  fd: FormData,
): Promise<ActionState<CreatedAccount>> {
  const me = await requireAdmin();
  const person = await memberOfMyCohort(me.cohort_id, str(fd, "user_id"));
  if (!person) return { error: "Person nicht gefunden." };

  const password = generatePassword(12);
  const { error } = await createAdminClient().auth.admin.updateUserById(person.id, { password });
  if (error) {
    console.error("Passwort-Reset", error);
    return { error: "Das Passwort konnte nicht zurückgesetzt werden." };
  }
  // Alle bisherigen Sitzungen beenden – wer das alte Passwort kannte, fliegt raus
  await revokeSessions(person.id);
  await audit("member.password_reset", { target: person.full_name });
  return {
    ok: true,
    message: "Neues Passwort erstellt – alle Geräte der Person wurden abgemeldet.",
    data: { full_name: person.full_name, username: person.username, password },
  };
}

export async function resetMemberMfa(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireAdmin();
  const person = await memberOfMyCohort(me.cohort_id, str(fd, "user_id"));
  if (!person) return { error: "Person nicht gefunden." };
  if (person.id === me.id) return { error: "Deine eigene 2FA verwaltest du im Profil." };

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.mfa.listFactors({ userId: person.id });
  if (error) {
    console.error("MFA-Faktoren laden", error);
    return { error: "Das hat nicht geklappt. Bitte versuch es nochmal." };
  }
  const factors = data?.factors ?? [];
  if (factors.length === 0) return { ok: true, message: `${person.full_name} hatte keine Zwei-Faktor-Anmeldung.` };
  for (const f of factors) await admin.auth.admin.mfa.deleteFactor({ userId: person.id, id: f.id });
  await revokeSessions(person.id);
  await audit("member.mfa_reset", { target: person.full_name });
  return { ok: true, message: `2FA von ${person.full_name} zurückgesetzt – bitte neu einrichten lassen.` };
}

export async function setRole(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireAdmin();
  const userId = str(fd, "user_id");
  const role: Role = str(fd, "role") === "admin" ? "admin" : "member";
  if (userId === me.id && role !== "admin") return { error: "Du kannst dir selbst die Admin-Rechte nicht entziehen." };
  const person = await memberOfMyCohort(me.cohort_id, userId);
  if (!person) return { error: "Person nicht gefunden." };
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ role }).eq("id", userId);
  if (error) return dbError(error);
  await audit("member.role_changed", { target: person.full_name, details: { role } });
  refresh();
  return { ok: true, message: role === "admin" ? "Ist jetzt Admin." : "Ist jetzt Mitglied." };
}

export async function renameMember(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireAdmin();
  const fullName = str(fd, "full_name").slice(0, 160);
  if (fullName.length < 2) return { error: "Bitte einen Namen angeben." };
  const person = await memberOfMyCohort(me.cohort_id, str(fd, "user_id"));
  if (!person) return { error: "Person nicht gefunden." };
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ full_name: fullName }).eq("id", person.id);
  if (error) return dbError(error);
  await audit("member.renamed", { target: fullName, details: { vorher: person.full_name } });
  refresh();
  return { ok: true, message: "Name gespeichert." };
}

export async function deleteMember(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireAdmin();
  const userId = str(fd, "user_id");
  if (userId === me.id) return { error: "Deinen eigenen Account löschst du im Profil." };
  const person = await memberOfMyCohort(me.cohort_id, userId);
  if (!person) return { error: "Person nicht gefunden." };
  const { error } = await createAdminClient().auth.admin.deleteUser(person.id);
  if (error) {
    console.error("Account löschen", error);
    return { error: "Der Account konnte nicht gelöscht werden." };
  }
  await audit("member.deleted", { target: `${person.full_name} (${person.username})` });
  refresh();
  return { ok: true, message: "Account gelöscht." };
}

// =================================================================== Neuigkeiten

export async function createAnnouncement(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  const title = str(fd, "title").slice(0, 200);
  if (!title) return { error: "Bitte einen Titel angeben." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("announcements")
    .insert({ title, body: str(fd, "body").slice(0, 5000), pinned: bool(fd, "pinned") });
  if (error) return dbError(error);
  refresh();
  return { ok: true, message: "Veröffentlicht – alle wurden benachrichtigt." };
}

export async function setAnnouncementPinned(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("announcements").update({ pinned: bool(fd, "pinned") }).eq("id", str(fd, "id"));
  if (error) return dbError(error);
  refresh();
  return { ok: true };
}

export async function deleteAnnouncement(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("announcements").delete().eq("id", str(fd, "id"));
  if (error) return dbError(error);
  refresh();
  return { ok: true, message: "Gelöscht." };
}

// =================================================================== Walkthrough

export async function completeAdminTour(): Promise<ActionState> {
  const me = await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ admin_tour_done_at: new Date().toISOString() }).eq("id", me.id);
  if (error) return dbError(error);
  revalidatePath("/admin", "layout");
  return { ok: true };
}

// =================================================================== Abstimmungen

export async function createPoll(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  const question = str(fd, "question").slice(0, 300);
  const options = fd
    .getAll("option")
    .map((o) => String(o).trim().slice(0, 200))
    .filter(Boolean)
    .slice(0, 20);
  const closesRaw = str(fd, "closes_at");
  let closes_at: string | null = null;
  try {
    closes_at = closesRaw ? fromLocalInput(closesRaw) : null;
  } catch {
    return { error: "Ungültiges Enddatum." };
  }

  if (!question) return { error: "Bitte eine Frage angeben." };
  if (options.length < 2) return { error: "Bitte mindestens zwei Antwortmöglichkeiten angeben." };
  if (new Set(options.map((o) => o.toLowerCase())).size !== options.length) {
    return { error: "Zwei Antwortmöglichkeiten sind gleich." };
  }

  const supabase = await createClient();
  const { data: poll, error } = await supabase
    .from("polls")
    .insert({
      question,
      description: optStr(fd, "description")?.slice(0, 1000) ?? null,
      allow_multiple: bool(fd, "allow_multiple"),
      anonymous: bool(fd, "anonymous"),
      closes_at,
    })
    .select("id")
    .single();
  if (error) return dbError(error);

  const { error: optionError } = await supabase
    .from("poll_options")
    .insert(options.map((label, i) => ({ poll_id: poll.id, label, sort_order: i })));
  if (optionError) {
    await supabase.from("polls").delete().eq("id", poll.id);
    return dbError(optionError);
  }

  refresh();
  return { ok: true, message: "Abstimmung gestartet – alle wurden benachrichtigt." };
}

export async function setPollClosed(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  const closed = bool(fd, "closed");
  const supabase = await createClient();
  const { error } = await supabase.from("polls").update({ closed }).eq("id", str(fd, "id"));
  if (error) return dbError(error);
  refresh();
  return { ok: true, message: closed ? "Abstimmung beendet." : "Abstimmung wieder geöffnet." };
}

export async function deletePoll(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("polls").delete().eq("id", str(fd, "id"));
  if (error) return dbError(error);
  refresh();
  return { ok: true, message: "Abstimmung gelöscht." };
}

// =================================================================== Jahrgang & Schule

export async function saveCohortSettings(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireAdmin();
  const schoolName = str(fd, "school_name");
  const cohortName = str(fd, "cohort_name");
  const gradYear = Number.parseInt(str(fd, "grad_year"), 10);
  if (schoolName.length < 2) return { error: "Bitte den Namen der Schule angeben." };
  if (cohortName.length < 2) return { error: "Bitte einen Namen für den Jahrgang angeben." };

  const supabase = await createClient();
  const { data: cohort } = await supabase.from("cohorts").select("school_id").eq("id", me.cohort_id).single();
  if (!cohort) return { error: "Jahrgang nicht gefunden." };

  // Admins dürfen per Spalten-Recht nur Anzeigenamen ändern (RLS + GRANT in der Datenbank)
  const { error: schoolError } = await supabase
    .from("schools")
    .update({ name: schoolName.slice(0, 160), city: optStr(fd, "city")?.slice(0, 100) ?? null })
    .eq("id", cohort.school_id);
  if (schoolError) return dbError(schoolError);
  const { error: cohortError } = await supabase
    .from("cohorts")
    .update({ name: cohortName.slice(0, 80), grad_year: Number.isFinite(gradYear) ? gradYear : null })
    .eq("id", me.cohort_id);
  if (cohortError) return dbError(cohortError);

  await audit("cohort.settings", { target: `${schoolName} · ${cohortName}` });
  refresh();
  return { ok: true, message: "Gespeichert." };
}

export async function regenerateJoinCode(): Promise<ActionState> {
  const me = await requireAdmin();
  const admin = createAdminClient();
  for (let attempt = 0; attempt < 5; attempt++) {
    const { error } = await admin.from("cohorts").update({ join_code: generateJoinCode() }).eq("id", me.cohort_id);
    if (!error) {
      await audit("cohort.join_code");
      refresh();
      return { ok: true, message: "Neuer Jahrgangs-Code erstellt. Der alte funktioniert nicht mehr." };
    }
    if (error.code !== "23505") return dbError(error);
  }
  return { error: "Bitte nochmal versuchen." };
}

export async function setRequireAdmin2fa(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireAdmin();
  const enabled = bool(fd, "enabled");
  if (enabled && (await getAal()).current !== "aal2") {
    return { error: "Richte zuerst selbst die Zwei-Faktor-Anmeldung ein (Profil → Zwei-Faktor-Anmeldung)." };
  }
  const supabase = await createClient();
  const { error } = await supabase.from("cohorts").update({ require_admin_2fa: enabled }).eq("id", me.cohort_id);
  if (error) return dbError(error);
  await audit("cohort.require_2fa", { details: { enabled } });
  refresh();
  return {
    ok: true,
    message: enabled
      ? "2FA ist jetzt Pflicht für alle Admins. Admins ohne 2FA haben bis zur Einrichtung keine Admin-Rechte."
      : "2FA-Pflicht für Admins ausgeschaltet.",
  };
}

/** Den ganzen Jahrgang mit allen Accounts und Daten endgültig löschen (z. B. nach dem Abi) */
export async function deleteCohort(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireAdmin();
  const admin = createAdminClient();
  const { data: cohort } = await admin.from("cohorts").select("id, name, school_id").eq("id", me.cohort_id).single();
  if (!cohort) return { error: "Jahrgang nicht gefunden." };
  if (str(fd, "confirm") !== cohort.name) return { error: `Bitte zur Bestätigung genau „${cohort.name}“ eintippen.` };
  if (!(await verifyOwnPassword(String(fd.get("password") ?? "")))) return { error: "Das Passwort stimmt nicht." };

  // Plattform-Protokoll (bleibt erhalten, da ohne Jahrgangs-Bezug)
  await audit("cohort.deleted", { cohortId: null, target: cohort.name, details: { cohort_id: cohort.id } });

  const { data: members } = await admin.from("profiles").select("id").eq("cohort_id", cohort.id);
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "global" });
  for (const m of members ?? []) {
    const { error } = await admin.auth.admin.deleteUser(m.id);
    if (error) console.error("Jahrgang löschen – Account", m.id, error);
  }
  await admin.from("cohorts").delete().eq("id", cohort.id);
  const { count } = await admin.from("cohorts").select("id", { count: "exact", head: true }).eq("school_id", cohort.school_id);
  if (!count) await admin.from("schools").delete().eq("id", cohort.school_id);

  (await cookies()).delete(COHORT_COOKIE);
  redirect("/?jahrgang-geloescht=1");
}
