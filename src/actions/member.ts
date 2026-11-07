"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { requireUser } from "@/lib/auth";
import { dispatchPendingPushesSafe, pushPublicKey, sendPushToUser } from "@/lib/push";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { dbError, int, optStr, str } from "@/lib/forms";
import { formatDateTime, nowMs } from "@/lib/dates";
import type { ActionState } from "@/lib/types";

const refresh = () => revalidatePath("/", "layout");

// ---------------------------------------------------------------- Schichten

export async function signUpForShift(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.from("shift_signups").insert({ shift_id: str(fd, "shift_id"), user_id: me.id });
  if (error) {
    return dbError(error, {
      "23505": "Du bist hier schon eingetragen.",
      "42501": "Für diese Schicht kann man sich nicht mehr eintragen.",
    });
  }
  refresh();
  return { ok: true, message: "Du bist eingetragen – danke!" };
}

export async function cancelShift(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireUser();
  const shiftId = str(fd, "shift_id");
  const supabase = await createClient();

  const { data: shift } = await supabase
    .from("shifts")
    .select("title, starts_at, event_id, events(title)")
    .eq("id", shiftId)
    .maybeSingle();

  const { error } = await supabase.from("shift_signups").delete().eq("shift_id", shiftId).eq("user_id", me.id);
  if (error) return dbError(error);

  // Kurzfristige Abmeldung (< 48 h) → Admins informieren
  if (shift && new Date(shift.starts_at).getTime() - nowMs() < 48 * 3_600_000) {
    const admin = createAdminClient();
    const { data: admins } = await admin.from("profiles").select("id").eq("role", "admin").eq("cohort_id", me.cohort_id);
    const eventTitle = (shift.events as unknown as { title: string } | null)?.title ?? "";
    if (admins?.length) {
      await admin.from("notifications").insert(
        admins
          .filter((a) => a.id !== me.id)
          .map((a) => ({
            user_id: a.id,
            title: "Kurzfristige Abmeldung",
            body: `${me.full_name} hat sich von „${shift.title}“ (${eventTitle}, ${formatDateTime(shift.starts_at)}) abgemeldet.`,
            link: `/admin/termine/${shift.event_id}`,
          })),
      );
      after(dispatchPendingPushesSafe);
    }
  }

  refresh();
  return { ok: true, message: "Du bist ausgetragen." };
}

// ---------------------------------------------------------------- Spenden / Dienste

export async function pledgeForNeed(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireUser();
  const quantity = Math.max(1, int(fd, "quantity", 1));
  const supabase = await createClient();
  const { error } = await supabase
    .from("need_pledges")
    .upsert(
      { need_id: str(fd, "need_id"), user_id: me.id, quantity, note: optStr(fd, "note") },
      { onConflict: "need_id,user_id" },
    );
  if (error) return dbError(error);
  refresh();
  return { ok: true, message: "Eingetragen – danke!" };
}

export async function withdrawPledge(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.from("need_pledges").delete().eq("need_id", str(fd, "need_id")).eq("user_id", me.id);
  if (error) return dbError(error);
  refresh();
  return { ok: true, message: "Eintrag entfernt." };
}

// ---------------------------------------------------------------- Anmerkungen

export async function addComment(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireUser();
  const body = str(fd, "body");
  if (!body) return { error: "Bitte etwas schreiben." };
  if (body.length > 2000) return { error: "Maximal 2000 Zeichen." };
  const supabase = await createClient();
  const { error } = await supabase.from("event_comments").insert({ event_id: str(fd, "event_id"), user_id: me.id, body });
  if (error) return dbError(error);
  refresh();
  return { ok: true };
}

export async function deleteComment(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.from("event_comments").delete().eq("id", str(fd, "id"));
  if (error) return dbError(error);
  refresh();
  return { ok: true, message: "Anmerkung gelöscht." };
}

// ---------------------------------------------------------------- Abstimmungen

export async function castVote(pollId: string, optionIds: string[]): Promise<ActionState> {
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.rpc("cast_vote", { p_poll_id: pollId, p_option_ids: optionIds });
  if (error) return dbError(error);
  refresh();
  return { ok: true };
}

// ---------------------------------------------------------------- Benachrichtigungen

export async function markAllNotificationsRead(): Promise<ActionState> {
  const me = await requireUser();
  const supabase = await createClient();
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", me.id)
    .is("read_at", null);
  if (error) return dbError(error);
  refresh();
  return { ok: true, message: "Alles als gelesen markiert." };
}

export async function clearReadNotifications(): Promise<ActionState> {
  const me = await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.from("notifications").delete().eq("user_id", me.id).not("read_at", "is", null);
  if (error) return dbError(error);
  refresh();
  return { ok: true, message: "Gelesene Benachrichtigungen gelöscht." };
}

// ---------------------------------------------------------------- Push

export async function sendTestPush(): Promise<ActionState> {
  const me = await requireUser();
  if (!pushPublicKey()) return { error: "Push ist auf dem Server nicht eingerichtet." };
  const devices = await sendPushToUser(me.id, {
    title: "Test-Benachrichtigung",
    body: "Push funktioniert – du verpasst ab jetzt nichts mehr.",
    url: "/benachrichtigungen",
    tag: "test",
  });
  if (devices === 0) return { error: "Auf keinem Gerät erreichbar – bitte Push neu aktivieren." };
  return { ok: true, message: devices === 1 ? "Test an 1 Gerät gesendet." : `Test an ${devices} Geräte gesendet.` };
}

// ---------------------------------------------------------------- Kalender-Abo

export async function regenerateCalendarToken(): Promise<ActionState> {
  const me = await requireUser();
  const admin = createAdminClient();
  const token = crypto.randomUUID().replace(/-/g, "");
  const { error } = await admin.from("profiles").update({ calendar_token: token }).eq("id", me.id);
  if (error) return dbError(error);
  refresh();
  return { ok: true, message: "Neuer Kalender-Link erstellt. Der alte funktioniert nicht mehr." };
}
