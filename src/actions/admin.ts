"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin, usernameToEmail } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { bool, dbError, int, num, optStr, str } from "@/lib/forms";
import { fromLocalInput } from "@/lib/dates";
import { safeUrl } from "@/lib/utils";
import { generatePassword, makeUsername, parseNameLine } from "@/lib/usernames";
import type { ActionState, NeedKind, Role } from "@/lib/types";

const refresh = () => revalidatePath("/", "layout");

function localTime(fd: FormData, key: string): string | null {
  const value = str(fd, key);
  if (!value) return null;
  try {
    return fromLocalInput(value);
  } catch {
    return null;
  }
}

// =================================================================== Termine

export async function saveEvent(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireAdmin();
  const id = optStr(fd, "id");
  const title = str(fd, "title");
  const starts_at = localTime(fd, "starts_at");
  const ends_at = localTime(fd, "ends_at");

  if (!title) return { error: "Bitte einen Titel angeben." };
  if (!starts_at) return { error: "Bitte Datum und Uhrzeit des Beginns angeben." };
  if (ends_at && ends_at < starts_at) return { error: "Das Ende liegt vor dem Beginn." };

  const rawMaps = optStr(fd, "maps_url");
  const maps_url = rawMaps ? safeUrl(rawMaps) : null;
  if (rawMaps && !maps_url) return { error: "Der Maps-Link muss mit https:// beginnen." };

  const payload = {
    title,
    description: optStr(fd, "description"),
    starts_at,
    ends_at,
    location_name: optStr(fd, "location_name"),
    address: optStr(fd, "address"),
    maps_url,
    notes: optStr(fd, "notes"),
    published: bool(fd, "published"),
  };

  const supabase = await createClient();
  if (id) {
    const { error } = await supabase.from("events").update(payload).eq("id", id);
    if (error) return dbError(error);
    refresh();
    return { ok: true, message: "Termin gespeichert." };
  }

  const { data, error } = await supabase.from("events").insert({ ...payload, created_by: me.id }).select("id").single();
  if (error) return dbError(error);
  refresh();
  redirect(`/admin/termine/${data.id}`);
}

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

// =================================================================== Schichten

export async function saveShift(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  const id = optStr(fd, "id");
  const title = str(fd, "title");
  const starts_at = localTime(fd, "starts_at");
  const ends_at = localTime(fd, "ends_at");
  const capacity = int(fd, "capacity", 1);

  if (!title) return { error: "Bitte eine Bezeichnung angeben (z. B. Kasse, Aufbau)." };
  if (!starts_at || !ends_at) return { error: "Bitte Beginn und Ende angeben." };
  if (ends_at <= starts_at) return { error: "Das Ende muss nach dem Beginn liegen." };
  if (capacity < 1) return { error: "Es muss mindestens 1 Person benötigt werden." };

  const payload = { title, description: optStr(fd, "description"), starts_at, ends_at, capacity };
  const supabase = await createClient();
  const { error } = id
    ? await supabase.from("shifts").update(payload).eq("id", id)
    : await supabase.from("shifts").insert({ ...payload, event_id: str(fd, "event_id") });
  if (error) return dbError(error);
  refresh();
  return { ok: true, message: id ? "Schicht gespeichert." : "Schicht angelegt." };
}

/** Mehrere aufeinanderfolgende Schichtblöcke erzeugen, z. B. 14–20 Uhr in 2-h-Blöcken */
export async function generateShifts(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  const title = str(fd, "title");
  const from = localTime(fd, "from");
  const to = localTime(fd, "to");
  const blockMinutes = int(fd, "block_minutes", 120);
  const capacity = int(fd, "capacity", 1);

  if (!title) return { error: "Bitte eine Bezeichnung angeben." };
  if (!from || !to || to <= from) return { error: "Bitte einen gültigen Zeitraum angeben." };
  if (blockMinutes < 15) return { error: "Ein Block muss mindestens 15 Minuten lang sein." };

  const rows = [];
  const end = new Date(to).getTime();
  for (let t = new Date(from).getTime(); t < end; t += blockMinutes * 60_000) {
    rows.push({
      event_id: str(fd, "event_id"),
      title,
      description: optStr(fd, "description"),
      starts_at: new Date(t).toISOString(),
      ends_at: new Date(Math.min(t + blockMinutes * 60_000, end)).toISOString(),
      capacity,
    });
    if (rows.length > 60) return { error: "Das wären zu viele Blöcke (max. 60)." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("shifts").insert(rows);
  if (error) return dbError(error);
  refresh();
  return { ok: true, message: `${rows.length} Schichten angelegt.` };
}

export async function deleteShift(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("shifts").delete().eq("id", str(fd, "id"));
  if (error) return dbError(error);
  refresh();
  return { ok: true, message: "Schicht gelöscht – Eingetragene wurden benachrichtigt." };
}

export async function adminAddSignup(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  const userId = str(fd, "user_id");
  if (!userId) return { error: "Bitte eine Person auswählen." };
  const supabase = await createClient();
  const { error } = await supabase.from("shift_signups").insert({ shift_id: str(fd, "shift_id"), user_id: userId });
  if (error) return dbError(error, { "23505": "Die Person ist schon eingetragen." });
  refresh();
  return { ok: true, message: "Person eingetragen." };
}

export async function adminRemoveSignup(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("shift_signups")
    .delete()
    .eq("shift_id", str(fd, "shift_id"))
    .eq("user_id", str(fd, "user_id"));
  if (error) return dbError(error);
  refresh();
  return { ok: true, message: "Person ausgetragen." };
}

export async function setAttendance(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  const value = str(fd, "attended");
  const attended = value === "true" ? true : value === "false" ? false : null;
  const supabase = await createClient();
  const { error } = await supabase
    .from("shift_signups")
    .update({ attended })
    .eq("shift_id", str(fd, "shift_id"))
    .eq("user_id", str(fd, "user_id"));
  if (error) return dbError(error);
  refresh();
  return { ok: true };
}

// =================================================================== Bedarf (Spenden, Leihgaben, Material)

const NEED_KINDS: NeedKind[] = ["spende", "leihgabe", "material"];

export async function saveNeed(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  const id = optStr(fd, "id");
  const title = str(fd, "title");
  const kind = str(fd, "kind") as NeedKind;
  const quantity_needed = int(fd, "quantity_needed", 1);

  if (!title) return { error: "Bitte angeben, was benötigt wird." };
  if (!NEED_KINDS.includes(kind)) return { error: "Ungültige Art." };
  if (quantity_needed < 1) return { error: "Die Menge muss mindestens 1 sein." };

  const payload = { title, kind, quantity_needed, unit: optStr(fd, "unit"), description: optStr(fd, "description") };
  const supabase = await createClient();
  const { error } = id
    ? await supabase.from("event_needs").update(payload).eq("id", id)
    : await supabase.from("event_needs").insert({ ...payload, event_id: str(fd, "event_id") });
  if (error) return dbError(error);
  refresh();
  return { ok: true, message: id ? "Gespeichert." : "Hinzugefügt." };
}

export async function deleteNeed(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("event_needs").delete().eq("id", str(fd, "id"));
  if (error) return dbError(error);
  refresh();
  return { ok: true, message: "Gelöscht." };
}

export async function setDelivered(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  const value = str(fd, "delivered");
  const supabase = await createClient();
  const { error } = await supabase
    .from("need_pledges")
    .update({ delivered: value === "true" ? true : value === "false" ? false : null })
    .eq("id", str(fd, "id"));
  if (error) return dbError(error);
  refresh();
  return { ok: true };
}

export async function adminRemovePledge(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("need_pledges").delete().eq("id", str(fd, "id"));
  if (error) return dbError(error);
  refresh();
  return { ok: true, message: "Eintrag entfernt." };
}

// =================================================================== Sortiment

export async function saveProduct(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  const id = optStr(fd, "id");
  const name = str(fd, "name");
  if (!name) return { error: "Bitte einen Namen angeben." };
  const payload = {
    name,
    price: num(fd, "price"),
    description: optStr(fd, "description"),
    sort_order: int(fd, "sort_order", 0),
  };
  const supabase = await createClient();
  const { error } = id
    ? await supabase.from("event_products").update(payload).eq("id", id)
    : await supabase.from("event_products").insert({ ...payload, event_id: str(fd, "event_id") });
  if (error) return dbError(error);
  refresh();
  return { ok: true, message: id ? "Gespeichert." : "Zum Sortiment hinzugefügt." };
}

export async function deleteProduct(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("event_products").delete().eq("id", str(fd, "id"));
  if (error) return dbError(error);
  refresh();
  return { ok: true, message: "Entfernt." };
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

// =================================================================== Abstimmungen

export async function createPoll(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireAdmin();
  const question = str(fd, "question");
  const options = fd
    .getAll("option")
    .map((o) => String(o).trim())
    .filter(Boolean);
  const closesRaw = str(fd, "closes_at");
  const closes_at = closesRaw ? fromLocalInput(closesRaw) : null;

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
