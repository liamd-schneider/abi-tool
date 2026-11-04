import { buildIcs, fileSlug, icsResponse } from "@/lib/calendar";
import { createClient } from "@/lib/supabase/server";

interface ShiftForIcs {
  id: string;
  title: string;
  description: string | null;
  starts_at: string;
  ends_at: string;
  events: { title: string; location_name: string | null; address: string | null; notes: string | null } | null;
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("shifts")
    .select("id, title, description, starts_at, ends_at, events(title, location_name, address, notes)")
    .eq("id", id)
    .maybeSingle();

  const shift = data as unknown as ShiftForIcs | null;
  if (!shift) return new Response("Schicht nicht gefunden oder nicht angemeldet.", { status: 404 });

  const title = `Schicht: ${shift.title} – ${shift.events?.title ?? ""}`;
  const ics = buildIcs(
    [
      {
        uid: `shift-${shift.id}@abi-tool`,
        title,
        start: shift.starts_at,
        end: shift.ends_at,
        location: [shift.events?.location_name, shift.events?.address].filter(Boolean).join(", ") || null,
        description: [shift.description, shift.events?.notes].filter(Boolean).join("\n\n") || null,
      },
    ],
    title,
  );
  return icsResponse(ics, `schicht-${fileSlug(shift.title)}.ics`);
}
