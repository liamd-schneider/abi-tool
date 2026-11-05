"use server";

// Aktionen, die ausschließlich Admins dürfen.
// (Alles, was einen einzelnen Termin betrifft und auch das Orga-Team darf, liegt in ./event.ts)

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin, usernameToEmail } from "@/lib/auth";
import { fromLocalInput } from "@/lib/dates";
import { isEventPermission } from "@/lib/event-permissions";
import { bool, dbError, optStr, str } from "@/lib/forms";
import { refreshAll as refresh } from "@/lib/refresh";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { ActionState, Role } from "@/lib/types";
import { generatePassword, makeUsername, parseNameLine } from "@/lib/usernames";

// =================================================================== Termine

export async function setEventPublished(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  const published = bool(fd, "published");
  const supabase = await createClient();
  const { error } = await supabase.from("events").update({ published }).eq("id", str(fd, "id"));
  if (error) return dbError(error);
  refresh();
  return { ok: true, message: published ? "Termin veröffentlicht – alle wurden benachrichtigt." : "Termin ist wieder Entwurf." };
}

export async function deleteEvent(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("events").delete().eq("id", str(fd, "id"));
  if (error) return dbError(error);
  refresh();
  redirect("/admin/termine");
}

// =================================================================== Orga-Team

export async function setOrganizer(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  const eventId = str(fd, "event_id");
  const userId = str(fd, "user_id");
  if (!userId) return { error: "Bitte eine Person auswählen." };
  const permissions = [...new Set(fd.getAll("permission").filter(isEventPermission))];

  const supabase = await createClient();
  const { error } = await supabase
    .from("event_organizers")
    .upsert({ event_id: eventId, user_id: userId, permissions }, { onConflict: "event_id,user_id" });
  if (error) return dbError(error);
  refresh();
  return { ok: true, message: fd.has("is_update") ? "Rechte gespeichert." : "Zum Orga-Team hinzugefügt – Person wurde benachrichtigt." };
}

export async function removeOrganizer(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("event_organizers")
    .delete()
    .eq("event_id", str(fd, "event_id"))
    .eq("user_id", str(fd, "user_id"));
  if (error) return dbError(error);
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
  await requireAdmin();
  const lines = str(fd, "names")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const role: Role = str(fd, "role") === "admin" ? "admin" : "member";
  if (lines.length === 0) return { error: "Bitte mindestens einen Namen eintragen." };
  if (lines.length > 200) return { error: "Maximal 200 Namen auf einmal." };

  const admin = createAdminClient();
  const { data: existing, error: loadError } = await admin.from("profiles").select("username, full_name");
  if (loadError) return dbError(loadError);

  const taken = new Map((existing ?? []).map((p) => [p.username, p.full_name.toLowerCase()]));
  const created: CreatedAccount[] = [];
  const errors: string[] = [];

  for (const line of lines) {
    const parsed = parseNameLine(line);
    if (!parsed) {
      errors.push(`„${line}“: bitte Vor- und Nachname angeben.`);
      continue;
    }
    const base = makeUsername(parsed.first, parsed.last);
    if (base.length < 3 || base.startsWith(".") || base.endsWith(".")) {
      errors.push(`„${line}“: daraus lässt sich kein Benutzername bilden.`);
      continue;
    }
    if (taken.get(base) === parsed.full.toLowerCase()) {
      errors.push(`${parsed.full} hat schon einen Account (${base}).`);
      continue;
    }

    let username = base;
    for (let i = 2; taken.has(username); i++) username = `${base}${i}`;

    const password = generatePassword();
    const { data, error } = await admin.auth.admin.createUser({
      email: usernameToEmail(username),
      password,
      email_confirm: true,
      app_metadata: { username },
      user_metadata: { full_name: parsed.full },
    });
    if (error || !data.user) {
      errors.push(`${parsed.full}: ${error?.message ?? "unbekannter Fehler"}`);
      continue;
    }

    const { error: profileError } = await admin
      .from("profiles")
      .insert({ id: data.user.id, username, full_name: parsed.full, role });
    if (profileError) {
      await admin.auth.admin.deleteUser(data.user.id);
      errors.push(`${parsed.full}: ${profileError.message}`);
      continue;
    }

    taken.set(username, parsed.full.toLowerCase());
    created.push({ full_name: parsed.full, username, password });
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
  await requireAdmin();
  const userId = str(fd, "user_id");
  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("username, full_name").eq("id", userId).maybeSingle();
  if (!profile) return { error: "Person nicht gefunden." };

  const password = generatePassword();
  const { error } = await admin.auth.admin.updateUserById(userId, { password });
  if (error) return { error: `Fehler: ${error.message}` };
  return { ok: true, message: "Neues Passwort erstellt.", data: { ...profile, password } };
}

export async function setRole(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireAdmin();
  const userId = str(fd, "user_id");
  const role: Role = str(fd, "role") === "admin" ? "admin" : "member";
  if (userId === me.id && role !== "admin") return { error: "Du kannst dir selbst die Admin-Rechte nicht entziehen." };
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ role }).eq("id", userId);
  if (error) return dbError(error);
  refresh();
  return { ok: true, message: role === "admin" ? "Ist jetzt Admin." : "Ist jetzt Mitglied." };
}

export async function renameMember(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  const fullName = str(fd, "full_name");
  if (fullName.length < 2) return { error: "Bitte einen Namen angeben." };
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ full_name: fullName }).eq("id", str(fd, "user_id"));
  if (error) return dbError(error);
  refresh();
  return { ok: true, message: "Name gespeichert." };
}

export async function deleteMember(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireAdmin();
  const userId = str(fd, "user_id");
  if (userId === me.id) return { error: "Du kannst deinen eigenen Account nicht löschen." };
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) return { error: `Fehler: ${error.message}` };
  refresh();
  return { ok: true, message: "Account gelöscht." };
}

// =================================================================== Neuigkeiten

export async function createAnnouncement(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireAdmin();
  const title = str(fd, "title");
  if (!title) return { error: "Bitte einen Titel angeben." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("announcements")
    .insert({ title, body: str(fd, "body"), pinned: bool(fd, "pinned"), created_by: me.id });
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
  const me = await requireAdmin();
  const question = str(fd, "question");
  const options = fd
    .getAll("option")
    .map((o) => String(o).trim())
    .filter(Boolean);
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
      description: optStr(fd, "description"),
      allow_multiple: bool(fd, "allow_multiple"),
      anonymous: bool(fd, "anonymous"),
      closes_at,
      created_by: me.id,
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
