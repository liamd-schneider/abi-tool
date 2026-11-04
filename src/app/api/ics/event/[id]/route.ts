import { buildIcs, fileSlug, icsResponse } from "@/lib/calendar";
import { createClient } from "@/lib/supabase/server";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: event } = await supabase
    .from("events")
    .select("id, title, description, notes, starts_at, ends_at, location_name, address")
    .eq("id", id)
    .maybeSingle();

  if (!event) return new Response("Termin nicht gefunden oder nicht angemeldet.", { status: 404 });

  const ics = buildIcs(
    [
      {
        uid: `event-${event.id}@abi-tool`,
        title: event.title,
        start: event.starts_at,
        end: event.ends_at,
        location: [event.location_name, event.address].filter(Boolean).join(", ") || null,
        description: [event.description, event.notes].filter(Boolean).join("\n\n") || null,
      },
    ],
    event.title,
  );
  return icsResponse(ics, `${fileSlug(event.title)}.ics`);
}
