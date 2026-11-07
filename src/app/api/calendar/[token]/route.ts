import { buildIcs, icsResponse, type CalendarItem } from "@/lib/calendar";
import { createAdminClient } from "@/lib/supabase/admin";

// Persönlicher Kalender-Feed zum Abonnieren (Google, Apple, Outlook).
// Kalender-Apps können keine Cookies mitschicken – darum geheimer Token in der URL.

interface FeedShift {
  shifts: {
    id: string;
    title: string;
    description: string | null;
    starts_at: string;
    ends_at: string;
    event_id: string;
    events: { title: string; location_name: string | null; address: string | null; published: boolean } | null;
  } | null;
}

export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token: rawToken } = await params;
  const token = rawToken.replace(/\.ics$/i, "");
  if (!/^[a-f0-9]{32}$/.test(token)) return new Response("Ungültiger Link", { status: 404 });

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("id, full_name, cohort_id")
    .eq("calendar_token", token)
    .maybeSingle();
  if (!profile) return new Response("Ungültiger Link", { status: 404 });

  const since = new Date(Date.now() - 60 * 86_400_000).toISOString();
  const origin = new URL(request.url).origin;

  const [{ data: events }, { data: signups }] = await Promise.all([
    admin
      .from("events")
      .select("id, title, description, starts_at, ends_at, location_name, address")
      .eq("cohort_id", profile.cohort_id)
      .eq("published", true)
      .gte("starts_at", since)
      .order("starts_at"),
    admin
      .from("shift_signups")
      .select("shifts!inner(id, title, description, starts_at, ends_at, event_id, events(title, location_name, address, published))")
      .eq("user_id", profile.id)
      .gte("shifts.starts_at", since),
  ]);

  const items: CalendarItem[] = (events ?? []).map((e) => ({
    uid: `event-${e.id}@abi-tool`,
    title: e.title,
    start: e.starts_at,
    end: e.ends_at,
    location: [e.location_name, e.address].filter(Boolean).join(", ") || null,
    description: [e.description, `${origin}/termine/${e.id}`].filter(Boolean).join("\n\n"),
    url: `${origin}/termine/${e.id}`,
  }));

  for (const { shifts: s } of (signups ?? []) as unknown as FeedShift[]) {
    if (!s || !s.events?.published) continue;
    items.push({
      uid: `shift-${s.id}@abi-tool`,
      title: `Schicht: ${s.title} – ${s.events.title}`,
      start: s.starts_at,
      end: s.ends_at,
      location: [s.events.location_name, s.events.address].filter(Boolean).join(", ") || null,
      description: [s.description, `${origin}/termine/${s.event_id}`].filter(Boolean).join("\n\n"),
      url: `${origin}/termine/${s.event_id}`,
    });
  }

  return icsResponse(buildIcs(items, "Abi-Tool"), "abi-tool.ics", true);
}
