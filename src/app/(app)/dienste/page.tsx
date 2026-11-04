import type { Metadata } from "next";
import Link from "next/link";
import { Cake } from "lucide-react";
import { NeedCard } from "@/components/need-card";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { requireUser } from "@/lib/auth";
import { formatRange, isUpcoming, nowMs } from "@/lib/dates";
import { NEED_SELECT } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";
import type { NeedWithPledges } from "@/lib/types";
import { FilterTabs } from "../filter-tabs";

export const metadata: Metadata = { title: "Dienste & Spenden" };

type NeedWithEvent = NeedWithPledges & {
  events: { id: string; title: string; starts_at: string; ends_at: string | null };
};

export default async function NeedsPage({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  const me = await requireUser();
  const { filter = "alle" } = await searchParams;
  const supabase = await createClient();
  const weekAgo = new Date(nowMs() - 7 * 86_400_000).toISOString();

  const { data } = await supabase
    .from("event_needs")
    .select(`${NEED_SELECT}, events!inner(id, title, starts_at, ends_at, published)`)
    .eq("events.published", true)
    .gte("events.starts_at", weekAgo)
    .order("created_at")
    .limit(500);

  const now = nowMs();
  let needs = ((data ?? []) as unknown as NeedWithEvent[]).filter((n) => isUpcoming(n.events.starts_at, n.events.ends_at, now));
  if (filter === "offen") {
    needs = needs.filter((n) => n.need_pledges.reduce((s, p) => s + p.quantity, 0) < n.quantity_needed);
  } else if (filter === "meine") {
    needs = needs.filter((n) => n.need_pledges.some((p) => p.user_id === me.id));
  }

  const groups = new Map<string, { event: NeedWithEvent["events"]; needs: NeedWithEvent[] }>();
  for (const n of [...needs].sort((a, b) => a.events.starts_at.localeCompare(b.events.starts_at))) {
    const group = groups.get(n.events.id) ?? { event: n.events, needs: [] };
    group.needs.push(n);
    groups.set(n.events.id, group);
  }

  return (
    <div>
      <PageHeader
        title="Dienste & Spenden"
        description="Kuchen, Waffelteig, Leihgaben wie Pavillons oder Material – trag ein, was du beisteuern kannst."
      />
      <FilterTabs
        basePath="/dienste"
        current={filter}
        options={[
          { value: "alle", label: "Alle" },
          { value: "offen", label: "Wird noch gebraucht" },
          { value: "meine", label: "Meine" },
        ]}
      />

      {groups.size === 0 ? (
        <EmptyState icon={<Cake className="size-6" />} title="Hier gibt es gerade nichts">
          {filter !== "alle" ? (
            <Link href="/dienste" className="font-medium text-primary hover:underline">
              Alle anzeigen
            </Link>
          ) : null}
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-8">
          {[...groups.values()].map(({ event, needs: list }) => (
            <section key={event.id}>
              <div className="mb-3">
                <Link href={`/termine/${event.id}`} className="text-lg font-semibold hover:underline">
                  {event.title}
                </Link>
                <p className="text-sm text-muted-foreground">{formatRange(event.starts_at, event.ends_at)}</p>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {list.map((n) => (
                  <NeedCard key={n.id} need={n} meId={me.id} event={{ id: event.id, title: event.title }} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
