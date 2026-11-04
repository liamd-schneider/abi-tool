import { getCurrentProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

interface SubscriptionBody {
  endpoint?: unknown;
  keys?: { p256dh?: unknown; auth?: unknown };
}

function validEndpoint(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 2000) return false;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

/** Push-Abo dieses Geräts speichern (auch vom Service Worker bei Schlüsselwechsel aufgerufen) */
export async function POST(request: Request) {
  const me = await getCurrentProfile();
  if (!me) return Response.json({ error: "Nicht angemeldet" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as SubscriptionBody | null;
  const p256dh = body?.keys?.p256dh;
  const auth = body?.keys?.auth;
  if (!body || !validEndpoint(body.endpoint) || typeof p256dh !== "string" || typeof auth !== "string" || p256dh.length > 200 || auth.length > 100) {
    return Response.json({ error: "Ungültiges Abo" }, { status: 400 });
  }

  // Mit Secret Key, damit ein Gerät auch nach einem Account-Wechsel korrekt umgehängt wird
  const admin = createAdminClient();
  const { error } = await admin.from("push_subscriptions").upsert(
    {
      user_id: me.id,
      endpoint: body.endpoint,
      p256dh,
      auth,
      user_agent: request.headers.get("user-agent")?.slice(0, 300) ?? null,
    },
    { onConflict: "endpoint" },
  );
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}

/** Push auf diesem Gerät abschalten */
export async function DELETE(request: Request) {
  const me = await getCurrentProfile();
  if (!me) return Response.json({ error: "Nicht angemeldet" }, { status: 401 });
  const body = (await request.json().catch(() => null)) as SubscriptionBody | null;
  if (!body || !validEndpoint(body.endpoint)) return Response.json({ error: "Ungültig" }, { status: 400 });

  const supabase = await createClient();
  await supabase.from("push_subscriptions").delete().eq("endpoint", body.endpoint).eq("user_id", me.id);
  return Response.json({ ok: true });
}
