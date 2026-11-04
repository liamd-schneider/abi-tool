import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, Plus } from "lucide-react";
import { DateBlock } from "@/components/event-bits";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState, PageHeader, SectionTitle } from "@/components/ui/misc";
import { formatRange, isUpcoming, nowMs } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Termine verwalten" };

interface AdminEventRow {
  id: string;
  title: string;
  starts_at: string;
  ends_at: string | null;
  location_name: string | null;
  published: boolean;
  shifts: { capacity: number; shift_signups: { user_id: string }[] }[];
  event_needs: { quantity_needed: number; need_pledges: { quantity: number }[] }[];
}

export default async function AdminEventsPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("events")
    .select(
      "id, title, starts_at, ends_at, location_name, published, shifts(capacity, shift_signups(user_id)), event_needs(quantity_needed, need_pledges(quantity))",
    )
    .order("starts_at")
    .limit(300);

  const now = nowMs();
  const all = (data ?? []) as unknown as AdminEventRow[];
  const upcoming = all.filter((e) => isUpcoming(e.starts_at, e.ends_at, now));
  const past = all.filter((e) => !isUpcoming(e.starts_at, e.ends_at, now)).reverse();

  const row = (e: AdminEventRow) => {
    const slots = e.shifts.reduce((s, x) => s + x.capacity, 0);
    const filled = e.shifts.reduce((s, x) => s + Math.min(x.capacity, x.shift_signups.length), 0);
    const needed = e.event_needs.reduce((s, x) => s + x.quantity_needed, 0);
    const pledged = e.event_needs.reduce(
      (s, x) => s + Math.min(x.quantity_needed, x.need_pledges.reduce((a, p) => a + p.quantity, 0)),
      0,
    );
    return (
      <Link
        key={e.id}
        href={`/admin/termine/${e.id}`}
        className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 transition-colors hover:border-primary/40"
      >
        <DateBlock iso={e.starts_at} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold">{e.title}</p>
            {e.published ? <Badge variant="success">veröffentlicht</Badge> : <Badge variant="warning">Entwurf</Badge>}
          </div>
          <p className="text-sm text-muted-foreground">{formatRange(e.starts_at, e.ends_at)}</p>
          <p className="text-xs text-muted-foreground">
            {e.shifts.length} Schichten ({filled}/{slots} Plätze) · Bedarf {pledged}/{needed}
          </p>
        </div>
      </Link>
    );
  };

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Termine & Schichten"
        className="mb-0"
        actions={
          <Link href="/admin/termine/neu" className={buttonVariants({ size: "sm" })}>
            <Plus className="size-4" /> Neuer Termin
          </Link>
        }
      />
      {all.length === 0 ? (
        <EmptyState icon={<CalendarDays className="size-6" />} title="Noch keine Termine">
          <Link href="/admin/termine/neu" className="font-medium text-primary hover:underline">
            Ersten Termin anlegen
          </Link>
        </EmptyState>
      ) : (
        <>
          <section>
            <SectionTitle>Anstehend</SectionTitle>
            {upcoming.length === 0 ? <p className="text-sm text-muted-foreground">Keine.</p> : <div className="flex flex-col gap-2">{upcoming.map(row)}</div>}
          </section>
          {past.length > 0 ? (
            <section>
              <SectionTitle>Vergangen</SectionTitle>
              <div className="flex flex-col gap-2 opacity-80">{past.map(row)}</div>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
