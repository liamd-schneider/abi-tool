import type { Metadata } from "next";
import { FileDown } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/misc";
import { formatHours, formatStamp } from "@/lib/dates";
import { loadMemberStats } from "@/lib/stats";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Statistik" };

export default async function StatsPage() {
  const supabase = await createClient();
  const stats = (await loadMemberStats(supabase)).sort(
    (a, b) => b.hoursDone + b.hoursPlanned - (a.hoursDone + a.hoursPlanned) || b.pledges - a.pledges,
  );

  const totals = stats.reduce(
    (t, s) => ({
      hours: t.hours + s.hoursDone,
      planned: t.planned + s.hoursPlanned,
      shifts: t.shifts + s.shiftsTotal,
      pledges: t.pledges + s.pledges,
    }),
    { hours: 0, planned: 0, shifts: 0, pledges: 0 },
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Statistik"
        description={`Insgesamt ${formatHours(totals.hours)} geleistet, ${formatHours(totals.planned)} geplant · ${totals.shifts} Schicht-Eintragungen · ${totals.pledges} Spenden/Dienste`}
        className="mb-0"
        actions={
          <>
            <a href="/api/admin/export?type=stats" className={buttonVariants({ variant: "outline", size: "sm" })}>
              <FileDown className="size-4" /> Statistik (CSV)
            </a>
            <a href="/api/admin/export?type=signups" className={buttonVariants({ variant: "outline", size: "sm" })}>
              <FileDown className="size-4" /> Alle Eintragungen (CSV)
            </a>
          </>
        }
      />

      {/* Handy: Kartenliste mit allen Zahlen */}
      <Card className="sm:hidden">
        <ul className="divide-y divide-border">
          {stats.map((s, i) => {
            const nothing = s.shiftsTotal === 0 && s.pledges === 0;
            return (
              <li key={s.id} className={nothing ? "px-4 py-3 text-muted-foreground" : "px-4 py-3"}>
                <div className="flex items-baseline gap-2">
                  <span className="w-6 shrink-0 text-xs tabular-nums text-muted-foreground">{i + 1}.</span>
                  <span className="min-w-0 flex-1 truncate font-medium">{s.full_name}</span>
                  <span className="shrink-0 text-sm font-semibold tabular-nums">{formatHours(s.hoursDone + s.hoursPlanned)}</span>
                </div>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 pl-8 text-xs text-muted-foreground">
                  <span>
                    {s.shiftsDone} geleistet{s.shiftsUpcoming > 0 ? ` · ${s.shiftsUpcoming} geplant` : ""}
                  </span>
                  <span>{s.pledges} Spenden</span>
                  {s.attended + s.missed > 0 ? (
                    <span>
                      ✓ {s.attended} / <span className={s.missed > 0 ? "font-semibold text-destructive" : undefined}>✗ {s.missed}</span>
                    </span>
                  ) : null}
                  {s.lastActivity ? <span>aktiv {formatStamp(s.lastActivity)}</span> : null}
                </div>
              </li>
            );
          })}
        </ul>
      </Card>

      {/* Ab Tablet: Tabelle */}
      <Card className="hidden overflow-x-auto sm:block">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="border-b border-border text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-2 font-medium">#</th>
              <th className="px-2 py-2 font-medium">Name</th>
              <th className="px-2 py-2 text-right font-medium">Schichten geleistet</th>
              <th className="px-2 py-2 text-right font-medium">geplant</th>
              <th className="px-2 py-2 text-right font-medium">Stunden</th>
              <th className="px-2 py-2 text-right font-medium" title="Erschienen / nicht erschienen">
                ✓ / ✗
              </th>
              <th className="px-2 py-2 text-right font-medium">Spenden</th>
              <th className="px-4 py-2 text-right font-medium">Zuletzt aktiv</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {stats.map((s, i) => {
              const nothing = s.shiftsTotal === 0 && s.pledges === 0;
              return (
                <tr key={s.id} className={nothing ? "text-muted-foreground" : undefined}>
                  <td className="px-4 py-2 tabular-nums">{i + 1}</td>
                  <td className="px-2 py-2 font-medium">{s.full_name}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{s.shiftsDone}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{s.shiftsUpcoming}</td>
                  <td className="px-2 py-2 text-right tabular-nums">
                    {formatHours(s.hoursDone)}
                    {s.hoursPlanned > 0 ? <span className="text-muted-foreground"> (+{formatHours(s.hoursPlanned)})</span> : null}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums">
                    {s.attended} / <span className={s.missed > 0 ? "font-semibold text-destructive" : undefined}>{s.missed}</span>
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums">{s.pledges}</td>
                  <td className="px-4 py-2 text-right text-xs">{s.lastActivity ? formatStamp(s.lastActivity) : "–"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
      <p className="text-xs text-muted-foreground">
        Vergangene Schichten zählen als geleistet, außer jemand wurde in der Schicht als „nicht erschienen“ (✗) markiert.
      </p>
    </div>
  );
}
