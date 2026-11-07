"use server";

// Aktionen für einzelne Termine – erlaubt für Admins und für das Orga-Team mit dem passenden Recht.
// Die Datenbank (RLS) prüft dieselben Rechte noch einmal.

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { fromLocalInput } from "@/lib/dates";
import type { EventPermission } from "@/lib/event-permissions";
import { bool, dbError, int, num, optStr, str } from "@/lib/forms";
import { canDo, getEventAccess } from "@/lib/permissions";
import { refreshAll } from "@/lib/refresh";
import { createClient } from "@/lib/supabase/server";
import type { ActionState, NeedKind } from "@/lib/types";
import { safeUrl } from "@/lib/utils";

function localTime(fd: FormData, key: string): string | null {
  const value = str(fd, key);
  if (!value) return null;
  try {
    return fromLocalInput(value);
  } catch {
    return null;
  }
}

async function guard(eventId: string | null | undefined, permission: EventPermission): Promise<ActionState | null> {
  await requireUser();
  if (!eventId) return { error: "Eintrag nicht gefunden." };
  const access = await getEventAccess(eventId);
  return canDo(access, permission) ? null : { error: "Dafür hast du bei diesem Termin keine Berechtigung." };
}

type EventScopedTable = "shifts" | "event_needs" | "event_products" | "shopping_items";

async function eventIdOf(table: EventScopedTable, id: string): Promise<string | null> {
  if (!id) return null;
  const supabase = await createClient();
  const { data } = await supabase.from(table).select("event_id").eq("id", id).maybeSingle();
  return (data?.event_id as string | undefined) ?? null;
}

async function eventIdOfPledge(id: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("need_pledges").select("event_needs(event_id)").eq("id", id).maybeSingle();
  return (data?.event_needs as unknown as { event_id: string } | null)?.event_id ?? null;
}

// =================================================================== Termindaten

export async function saveEvent(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireUser();
  const id = optStr(fd, "id");
  const isAdmin = me.role === "admin";

  if (id) {
    const denied = await guard(id, "details");
    if (denied) return denied;
  } else if (!isAdmin) {
    return { error: "Nur Admins können Termine anlegen." };
  }

  const title = str(fd, "title");
  const starts_at = localTime(fd, "starts_at");
  const ends_at = localTime(fd, "ends_at");
  if (!title) return { error: "Bitte einen Titel angeben." };
  if (!starts_at) return { error: "Bitte Datum und Uhrzeit des Beginns angeben." };
  if (ends_at && ends_at < starts_at) return { error: "Das Ende liegt vor dem Beginn." };

  const rawMaps = optStr(fd, "maps_url");
  const maps_url = rawMaps ? safeUrl(rawMaps) : null;
  if (rawMaps && !maps_url) return { error: "Der Maps-Link muss mit https:// beginnen." };

  const payload: Record<string, unknown> = {
    title,
    description: optStr(fd, "description"),
    starts_at,
    ends_at,
    location_name: optStr(fd, "location_name"),
    address: optStr(fd, "address"),
    maps_url,
    notes: optStr(fd, "notes"),
  };
  // Veröffentlichen dürfen nur Admins
  if (isAdmin) payload.published = bool(fd, "published");

  const supabase = await createClient();
  if (id) {
    const { error } = await supabase.from("events").update(payload).eq("id", id);
    if (error) return dbError(error);
    refreshAll();
    return { ok: true, message: "Termin gespeichert." };
  }

  const { data, error } = await supabase.from("events").insert({ ...payload, created_by: me.id }).select("id").single();
  if (error) return dbError(error);
  refreshAll();
  redirect(`/admin/termine/${data.id}`);
}

// =================================================================== Schichten

export async function saveShift(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const id = optStr(fd, "id");
  const eventId = id ? await eventIdOf("shifts", id) : str(fd, "event_id");
  const denied = await guard(eventId, "schichten");
  if (denied) return denied;

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
    : await supabase.from("shifts").insert({ ...payload, event_id: eventId });
  if (error) return dbError(error);
  refreshAll();
  return { ok: true, message: id ? "Schicht gespeichert." : "Schicht angelegt." };
}

/** Mehrere aufeinanderfolgende Schichtblöcke erzeugen, z. B. 14–20 Uhr in 2-h-Blöcken */
export async function generateShifts(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const eventId = str(fd, "event_id");
  const denied = await guard(eventId, "schichten");
  if (denied) return denied;

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
      event_id: eventId,
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
  refreshAll();
  return { ok: true, message: `${rows.length} Schichten angelegt.` };
}

export async function deleteShift(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const id = str(fd, "id");
  const denied = await guard(await eventIdOf("shifts", id), "schichten");
  if (denied) return denied;
  const supabase = await createClient();
  const { error } = await supabase.from("shifts").delete().eq("id", id);
  if (error) return dbError(error);
  refreshAll();
  return { ok: true, message: "Schicht gelöscht – Eingetragene wurden benachrichtigt." };
}

export async function addSignupFor(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const shiftId = str(fd, "shift_id");
  const denied = await guard(await eventIdOf("shifts", shiftId), "schichten");
  if (denied) return denied;
  const userId = str(fd, "user_id");
  if (!userId) return { error: "Bitte eine Person auswählen." };
  const supabase = await createClient();
  const { error } = await supabase.from("shift_signups").insert({ shift_id: shiftId, user_id: userId });
  if (error) return dbError(error, { "23505": "Die Person ist schon eingetragen." });
  refreshAll();
  return { ok: true, message: "Person eingetragen." };
}

export async function removeSignupFor(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const shiftId = str(fd, "shift_id");
  const denied = await guard(await eventIdOf("shifts", shiftId), "schichten");
  if (denied) return denied;
  const supabase = await createClient();
  const { error } = await supabase.from("shift_signups").delete().eq("shift_id", shiftId).eq("user_id", str(fd, "user_id"));
  if (error) return dbError(error);
  refreshAll();
  return { ok: true, message: "Person ausgetragen." };
}

export async function setAttendance(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const shiftId = str(fd, "shift_id");
  const denied = await guard(await eventIdOf("shifts", shiftId), "schichten");
  if (denied) return denied;
  const value = str(fd, "attended");
  const attended = value === "true" ? true : value === "false" ? false : null;
  const supabase = await createClient();
  const { error } = await supabase
    .from("shift_signups")
    .update({ attended })
    .eq("shift_id", shiftId)
    .eq("user_id", str(fd, "user_id"));
  if (error) return dbError(error);
  refreshAll();
  return { ok: true };
}

// =================================================================== Bedarf (Spenden, Leihgaben, Material)

const NEED_KINDS: NeedKind[] = ["spende", "leihgabe", "material"];

export async function saveNeed(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const id = optStr(fd, "id");
  const eventId = id ? await eventIdOf("event_needs", id) : str(fd, "event_id");
  const denied = await guard(eventId, "bedarf");
  if (denied) return denied;

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
    : await supabase.from("event_needs").insert({ ...payload, event_id: eventId });
  if (error) return dbError(error);
  refreshAll();
  return { ok: true, message: id ? "Gespeichert." : "Hinzugefügt." };
}

export async function deleteNeed(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const id = str(fd, "id");
  const denied = await guard(await eventIdOf("event_needs", id), "bedarf");
  if (denied) return denied;
  const supabase = await createClient();
  const { error } = await supabase.from("event_needs").delete().eq("id", id);
  if (error) return dbError(error);
  refreshAll();
  return { ok: true, message: "Gelöscht." };
}

/** Jemanden "nach Zuruf" bei einer Spende eintragen – oder die Menge der Person ändern */
export async function addPledgeFor(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const needId = str(fd, "need_id");
  const denied = await guard(await eventIdOf("event_needs", needId), "bedarf");
  if (denied) return denied;
  const userId = str(fd, "user_id");
  if (!userId) return { error: "Bitte eine Person auswählen." };
  const quantity = Math.max(1, int(fd, "quantity", 1));

  const supabase = await createClient();
  const { error } = await supabase
    .from("need_pledges")
    .upsert({ need_id: needId, user_id: userId, quantity, note: optStr(fd, "note") }, { onConflict: "need_id,user_id" });
  if (error) return dbError(error);
  refreshAll();
  return { ok: true, message: "Eingetragen." };
}

export async function setDelivered(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const id = str(fd, "id");
  const denied = await guard(await eventIdOfPledge(id), "bedarf");
  if (denied) return denied;
  const value = str(fd, "delivered");
  const supabase = await createClient();
  const { error } = await supabase
    .from("need_pledges")
    .update({ delivered: value === "true" ? true : value === "false" ? false : null })
    .eq("id", id);
  if (error) return dbError(error);
  refreshAll();
  return { ok: true };
}

export async function removePledge(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const id = str(fd, "id");
  const denied = await guard(await eventIdOfPledge(id), "bedarf");
  if (denied) return denied;
  const supabase = await createClient();
  const { error } = await supabase.from("need_pledges").delete().eq("id", id);
  if (error) return dbError(error);
  refreshAll();
  return { ok: true, message: "Eintrag entfernt." };
}

// =================================================================== Sortiment

export async function saveProduct(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const id = optStr(fd, "id");
  const eventId = id ? await eventIdOf("event_products", id) : str(fd, "event_id");
  const denied = await guard(eventId, "sortiment");
  if (denied) return denied;

  const name = str(fd, "name");
  if (!name) return { error: "Bitte einen Namen angeben." };
  const payload = { name, price: num(fd, "price"), description: optStr(fd, "description"), sort_order: int(fd, "sort_order", 0) };
  const supabase = await createClient();
  const { error } = id
    ? await supabase.from("event_products").update(payload).eq("id", id)
    : await supabase.from("event_products").insert({ ...payload, event_id: eventId });
  if (error) return dbError(error);
  refreshAll();
  return { ok: true, message: id ? "Gespeichert." : "Zum Sortiment hinzugefügt." };
}

export async function deleteProduct(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const id = str(fd, "id");
  const denied = await guard(await eventIdOf("event_products", id), "sortiment");
  if (denied) return denied;
  const supabase = await createClient();
  const { error } = await supabase.from("event_products").delete().eq("id", id);
  if (error) return dbError(error);
  refreshAll();
  return { ok: true, message: "Entfernt." };
}

// =================================================================== Einkaufsliste

export async function saveShoppingItem(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireUser();
  const id = optStr(fd, "id");
  const eventId = id ? await eventIdOf("shopping_items", id) : str(fd, "event_id");
  const denied = await guard(eventId, "einkauf");
  if (denied) return denied;

  const title = str(fd, "title");
  if (!title) return { error: "Bitte angeben, was gekauft werden soll." };
  if (title.length > 200) return { error: "Maximal 200 Zeichen." };

  const payload: Record<string, unknown> = {
    title,
    quantity: optStr(fd, "quantity")?.slice(0, 60) ?? null,
    note: optStr(fd, "note")?.slice(0, 500) ?? null,
    assigned_to: optStr(fd, "assigned_to"),
  };
  if (fd.has("cost")) {
    const cost = num(fd, "cost");
    if (cost !== null && cost < 0) return { error: "Der Betrag darf nicht negativ sein." };
    payload.cost = cost;
  }

  const supabase = await createClient();
  const { error } = id
    ? await supabase.from("shopping_items").update(payload).eq("id", id)
    : await supabase.from("shopping_items").insert({ ...payload, event_id: eventId, created_by: me.id });
  if (error) return dbError(error);
  refreshAll();
  return { ok: true, message: id ? "Gespeichert." : "Auf die Einkaufsliste gesetzt." };
}

export async function setShoppingBought(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireUser();
  const id = str(fd, "id");
  const denied = await guard(await eventIdOf("shopping_items", id), "einkauf");
  if (denied) return denied;
  const bought = bool(fd, "bought");
  const supabase = await createClient();
  const { error } = await supabase
    .from("shopping_items")
    .update(bought ? { bought_at: new Date().toISOString(), bought_by: me.id } : { bought_at: null, bought_by: null })
    .eq("id", id);
  if (error) return dbError(error);
  refreshAll();
  return { ok: true, message: bought ? "Abgehakt." : "Wieder offen." };
}

export async function deleteShoppingItem(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const id = str(fd, "id");
  const denied = await guard(await eventIdOf("shopping_items", id), "einkauf");
  if (denied) return denied;
  const supabase = await createClient();
  const { error } = await supabase.from("shopping_items").delete().eq("id", id);
  if (error) return dbError(error);
  refreshAll();
  return { ok: true, message: "Von der Liste entfernt." };
}
