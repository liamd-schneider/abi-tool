import type { Metadata } from "next";
import Link from "next/link";
import { Clock } from "lucide-react";
import { ShiftCard } from "@/components/shift-card";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { requireUser } from "@/lib/auth";
import { formatRange, nowIso } from "@/lib/dates";
import { SHIFT_SELECT } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";
import type { ShiftWithSignups } from "@/lib/types";
import { FilterTabs } from "../filter-tabs";

export const metadata: Metadata = { title: "Schichten" };

type ShiftWithEvent = ShiftWithSignups & {
  events: { id: string; title: string; starts_at: string; ends_at: string | null; location_name: string | null; address: string | null };
};

export default async function ShiftsPage({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  const me = await requireUser();
  const { filter = "alle" } = await searchParams;
  const supabase = await createClient();

  const { data } = await supabase
    .from("shifts")
    .select(`${SHIFT_SELECT}, events!inner(id, title, starts_at, ends_at, location_name, address, published)`)
    .eq("events.published", true)
    .gte("ends_at", nowIso())
    .order("starts_at")
    .limit(500);

  let shifts = (data ?? []) as unknown as ShiftWithEvent[];
  if (filter === "frei") {
    shifts = shifts.filter((s) => s.shift_signups.length < s.capacity && !s.shift_signups.some((x) => x.user_id === me.id));
  } else if (filter === "meine") {
    shifts = shifts.filter((s) => s.shift_signups.some((x) => x.user_id === me.id));
  }

  // Nach Termin gruppieren (Reihenfolge = erste Schicht)
  const groups = new Map<string, { event: ShiftWithEvent["events"]; shifts: ShiftWithEvent[] }>();
  for (const s of shifts) {
    const group = groups.get(s.events.id) ?? { event: s.events, shifts: [] };
    group.shifts.push(s);
    groups.set(s.events.id, group);
  }

  return (
    <div>
      <PageHeader title="Schichten" description="Trag dich ein, wo du helfen kannst – alle sehen, wer wo dabei ist." />
      <FilterTabs
        basePath="/schichten"
        current={filter}
        options={[
          { value: "alle", label: "Alle" },
          { value: "frei", label: "Noch frei" },
          { value: "meine", label: "Meine" },
        ]}
      />

      {groups.size === 0 ? (
        <EmptyState icon={<Clock className="size-6" />} title={filter === "meine" ? "Du bist für keine anstehende Schicht eingetragen" : "Keine Schichten gefunden"}>
          {filter !== "alle" ? (
            <Link href="/schichten" className="font-medium text-primary hover:underline">
              Alle Schichten anzeigen
            </Link>
          ) : null}
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-8">
          {[...groups.values()].map(({ event, shifts: list }) => {
            const location = [event.location_name, event.address].filter(Boolean).join(", ") || null;
            return (
              <section key={event.id}>
                <div className="mb-3">
                  <Link href={`/termine/${event.id}`} className="text-lg font-semibold hover:underline">
                    {event.title}
                  </Link>
                  <p className="text-sm text-muted-foreground">{formatRange(event.starts_at, event.ends_at)}</p>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  {list.map((s) => (
                    <ShiftCard key={s.id} shift={s} meId={me.id} event={{ id: event.id, title: event.title, location }} />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
