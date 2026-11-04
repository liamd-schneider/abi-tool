import "server-only";
import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";

// Web-Push über VAPID (keine Google Console / kein Firebase nötig).
// Benachrichtigungen landen immer zuerst in der Tabelle `notifications` (Glocke in der App);
// dispatchPendingPushes() schickt alle noch nicht gepushten zusätzlich aufs Handy.

export interface PushPayload {
  title: string;
  body?: string | null;
  url?: string;
  tag?: string;
}

interface SubscriptionRow {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

export function pushPublicKey() {
  return process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || null;
}

let configured: boolean | null = null;

function ensureConfigured() {
  if (configured !== null) return configured;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) {
    configured = false;
    return false;
  }
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "https://github.com/liamd-schneider/abi-tool", publicKey, privateKey);
  configured = true;
  return true;
}

async function deliver(jobs: { sub: SubscriptionRow; payload: PushPayload }[]) {
  if (jobs.length === 0) return 0;
  const dead = new Set<string>();
  const ok = new Set<string>();

  await Promise.allSettled(
    jobs.map(async ({ sub, payload }) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify(payload),
          { TTL: 12 * 3600, urgency: "high" },
        );
        ok.add(sub.id);
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode;
        // 404/410 = Abo existiert nicht mehr (App deinstalliert, Berechtigung entzogen …)
        if (status === 404 || status === 410) dead.add(sub.id);
        else console.error("Push fehlgeschlagen", status, (error as Error).message);
      }
    }),
  );

  const admin = createAdminClient();
  if (dead.size) await admin.from("push_subscriptions").delete().in("id", [...dead]);
  if (ok.size) await admin.from("push_subscriptions").update({ last_success_at: new Date().toISOString() }).in("id", [...ok]);
  return ok.size;
}

/** Schickt alle Benachrichtigungen der letzten 24 h, die noch nicht gepusht wurden. */
export async function dispatchPendingPushes() {
  if (!ensureConfigured()) return 0;
  const admin = createAdminClient();
  const since = new Date(Date.now() - 24 * 3_600_000).toISOString();

  // Atomar "beanspruchen", damit parallele Aufrufe nichts doppelt senden
  const { data: claimed, error } = await admin
    .from("notifications")
    .update({ pushed_at: new Date().toISOString() })
    .is("pushed_at", null)
    .gte("created_at", since)
    .select("id, user_id, title, body, link, created_at");
  if (error) {
    console.error("Push-Dispatch", error.message);
    return 0;
  }
  if (!claimed?.length) return 0;

  const byUser = new Map<string, typeof claimed>();
  for (const n of claimed) byUser.set(n.user_id, [...(byUser.get(n.user_id) ?? []), n]);

  const { data: subs } = await admin
    .from("push_subscriptions")
    .select("id, user_id, endpoint, p256dh, auth")
    .in("user_id", [...byUser.keys()]);
  if (!subs?.length) return 0;

  const jobs: { sub: SubscriptionRow; payload: PushPayload }[] = [];
  for (const sub of subs as SubscriptionRow[]) {
    const list = (byUser.get(sub.user_id) ?? []).sort((a, b) => b.created_at.localeCompare(a.created_at));
    if (list.length > 3) {
      // Nicht spammen: viele auf einmal → eine Sammel-Benachrichtigung
      jobs.push({
        sub,
        payload: {
          title: `${list.length} neue Benachrichtigungen`,
          body: list
            .slice(0, 3)
            .map((n) => n.title)
            .join(" · "),
          url: "/benachrichtigungen",
          tag: "sammel",
        },
      });
    } else {
      for (const n of list) {
        jobs.push({ sub, payload: { title: n.title, body: n.body, url: `/api/notifications/${n.id}/open`, tag: n.id } });
      }
    }
  }
  return deliver(jobs);
}

/** Für after(): Fehler nie bis zum Nutzer durchschlagen lassen. */
export async function dispatchPendingPushesSafe() {
  try {
    await dispatchPendingPushes();
  } catch (error) {
    console.error("Push-Dispatch fehlgeschlagen", error);
  }
}

/** Direkt an alle Geräte einer Person (z. B. Test-Push). Gibt die Anzahl erreichter Geräte zurück. */
export async function sendPushToUser(userId: string, payload: PushPayload) {
  if (!ensureConfigured()) return 0;
  const admin = createAdminClient();
  const { data: subs } = await admin.from("push_subscriptions").select("id, user_id, endpoint, p256dh, auth").eq("user_id", userId);
  return deliver(((subs ?? []) as SubscriptionRow[]).map((sub) => ({ sub, payload })));
}
