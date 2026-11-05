import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, Clock, Package } from "lucide-react";
import { DateBlock } from "@/components/event-bits";
import { Badge } from "@/components/ui/badge";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { Progress } from "@/components/ui/progress";
import { requireUser } from "@/lib/auth";
import { formatRange, isUpcoming, nowMs, relativeDay } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Termine" };

interface EventListRow {
  id: string;
  title: string;
  description: string | null;
  starts_at: string;
  ends_at: string | null;
  location_name: string | null;
  shifts: { capacity: number; shift_signups: { user_id: string }[] }[];
  event_needs: { quantity_needed: number; need_pledges: { quantity: number }[] }[];
}

export default async function EventsPage({ searchParams }: { searchParams: Promise<{ zeit?: string }> }) {
  const me = await requireUser();
  const { zeit } = await searchParams;
  const showPast = zeit === "vergangen";
  const supabase = await createClient();

  const { data } = await supabase
    .from("events")
    .select(
      "id, title, description, starts_at, ends_at, location_name, shifts(capacity, shift_signups(user_id)), event_needs(quantity_needed, need_pledges(quantity))",
    )
    .eq("published", true)
    .order("starts_at", { ascending: !showPast })
    .limit(100);

  const now = nowMs();
  const events = ((data ?? []) as unknown as EventListRow[]).filter((e) => isUpcoming(e.starts_at, e.ends_at, now) !== showPast);

  return (
    <div>
      <PageHeader title="Termine" description="Alle Events unseres Jahrgangs" />

      <div className="mb-4 flex gap-2">
        <Link
          href="/termine"
          className={cn(
            "rounded-full border px-3 py-1 text-sm font-medium",
            !showPast ? "border-primary bg-primary-soft text-primary" : "border-border text-muted-foreground",
          )}
        >
          Anstehend
        </Link>
        <Link
          href="/termine?zeit=vergangen"
          className={cn(
            "rounded-full border px-3 py-1 text-sm font-medium",
            showPast ? "border-primary bg-primary-soft text-primary" : "border-border text-muted-foreground",
          )}
        >
          Vergangen
        </Link>
      </div>

      {events.length === 0 ? (
        <EmptyState icon={<CalendarDays className="size-6" />} title={showPast ? "Noch keine vergangenen Termine" : "Keine anstehenden Termine"} />
      ) : (
        <div className="flex flex-col gap-3">
          {events.map((e) => {
            const slots = e.shifts.reduce((s, x) => s + x.capacity, 0);
            const filled = e.shifts.reduce((s, x) => s + Math.min(x.capacity, x.shift_signups.length), 0);
            const mineCount = e.shifts.filter((x) => x.shift_signups.some((s) => s.user_id === me.id)).length;
            const needed = e.event_needs.reduce((s, x) => s + x.quantity_needed, 0);
            const pledged = e.event_needs.reduce(
              (s, x) => s + Math.min(x.quantity_needed, x.need_pledges.reduce((a, p) => a + p.quantity, 0)),
              0,
            );
            return (
              <Link
                key={e.id}
                href={`/termine/${e.id}`}
                className="flex gap-4 rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/40"
              >
                <DateBlock iso={e.starts_at} />
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold">{e.title}</p>
                      <p className="text-sm text-muted-foreground">{formatRange(e.starts_at, e.ends_at)}</p>
                      {e.location_name ? <p className="text-sm text-muted-foreground">{e.location_name}</p> : null}
                    </div>
                    <div className="flex gap-1.5">
                      {mineCount > 0 ? <Badge>Du bist dabei</Badge> : null}
                      {!showPast ? <Badge variant="muted">{relativeDay(e.starts_at, now)}</Badge> : null}
                    </div>
                  </div>
                  {slots > 0 || needed > 0 ? (
                    <div className="grid grid-cols-1 gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                      {slots > 0 ? (
                        <div className="flex items-center gap-2">
                          <Clock className="size-3.5" />
                          <span className="w-28 shrink-0">
                            Schichten {filled}/{slots}
                          </span>
                          <Progress value={filled} max={slots} />
                        </div>
                      ) : null}
                      {needed > 0 ? (
                        <div className="flex items-center gap-2">
                          <Package className="size-3.5" />
                          <span className="w-28 shrink-0">
                            Dienste {pledged}/{needed}
                          </span>
                          <Progress value={pledged} max={needed} />
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
