import { formatTime, relativeDay } from "@/lib/dates";
import { dispatchPendingPushes } from "@/lib/push";
import { safeEqual } from "@/lib/security/request-guard";
import { createAdminClient } from "@/lib/supabase/admin";

// Wird von Vercel Cron aufgerufen (siehe vercel.json): erinnert an Schichten in den nächsten 36 Stunden.

interface DueSignup {
  shift_id: string;
  user_id: string;
  shifts: { title: string; starts_at: string; event_id: string; events: { title: string; published: boolean } | null } | null;
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || !safeEqual(request.headers.get("authorization") ?? "", `Bearer ${secret}`)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const admin = createAdminClient();
  const now = new Date();
  const until = new Date(now.getTime() + 36 * 3_600_000);

  const { data, error } = await admin
    .from("shift_signups")
    .select("shift_id, user_id, shifts!inner(title, starts_at, event_id, events(title, published))")
    .is("reminded_at", null)
    .gte("shifts.starts_at", now.toISOString())
    .lte("shifts.starts_at", until.toISOString());
  if (error) return Response.json({ error: error.message }, { status: 500 });

  const due = ((data ?? []) as unknown as DueSignup[]).filter((d) => d.shifts?.events?.published);

  if (due.length > 0) {
    const { error: insertError } = await admin.from("notifications").insert(
      due.map((d) => ({
        user_id: d.user_id,
        title: `Erinnerung: ${d.shifts!.title} ${relativeDay(d.shifts!.starts_at)} um ${formatTime(d.shifts!.starts_at)} Uhr`,
        body: `${d.shifts!.events!.title} – du bist eingetragen. Danke fürs Helfen!`,
        link: `/termine/${d.shifts!.event_id}`,
      })),
    );
    if (insertError) return Response.json({ error: insertError.message }, { status: 500 });

    const stamp = now.toISOString();
    await Promise.all(
      due.map((d) =>
        admin.from("shift_signups").update({ reminded_at: stamp }).eq("shift_id", d.shift_id).eq("user_id", d.user_id),
      ),
    );
  }

  // Erinnerungen (und evtl. liegengebliebene Benachrichtigungen) als Push verschicken
  const pushed = await dispatchPendingPushes();

  // Tägliche Datenbereinigung (alte Benachrichtigungen, Rate-Limits, Anonymisierung …)
  const { data: maintenance, error: maintenanceError } = await admin.rpc("run_maintenance");
  if (maintenanceError) console.error("Wartung", maintenanceError.message);

  return Response.json({ reminded: due.length, pushed, maintenance });
}
