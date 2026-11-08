import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Clock } from "lucide-react";
import { ActionForm, Hidden, SubmitButton } from "@/components/action-form";
import { StatTile } from "@/components/stat-tile";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState, Notice, PageHeader, SectionTitle } from "@/components/ui/misc";
import { WeeklyBars } from "@/components/weekly-bars";
import { approveCohort } from "@/actions/platform";
import { requirePlatformAdmin } from "@/lib/auth";
import { relativeDay } from "@/lib/dates";
import { loadPlatformStats, type CohortStats } from "@/lib/platform-stats";

export const metadata: Metadata = { title: "System-Admin" };

const pct = (part: number, total: number) => (total > 0 ? Math.round((part / total) * 100) : 0);

function StatusBadge({ c }: { c: CohortStats }) {
  if (c.pending) return <Badge variant="warning">wartet auf Freigabe</Badge>;
  if (!c.active) return <Badge variant="destructive">gesperrt</Badge>;
  return <Badge variant="success">aktiv</Badge>;
}

function CohortName({ c, mine }: { c: CohortStats; mine: boolean }) {
  return (
    <>
      <span className="font-medium break-words">
        {c.schoolName}
        {c.city ? `, ${c.city}` : ""}
      </span>
      <span className="block text-xs text-muted-foreground">
        {c.name}
        {mine ? " · dein Jahrgang" : ""}
      </span>
    </>
  );
}

function lastSeen(iso: string | null) {
  return iso ? relativeDay(iso) : "–";
}

export default async function PlatformOverviewPage() {
  const me = await requirePlatformAdmin();
  const { cohorts, totals, weeks } = await loadPlatformStats();
  const pending = cohorts.filter((c) => c.pending);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Alle Schulen" description="Wie viele Schulen, Jahrgänge und Mitglieder die Plattform nutzen." className="mb-0" />

      {pending.length > 0 ? (
        <Notice tone="warning" icon={<Clock className="size-5 text-warning-foreground" />}>
          <p className="font-medium">
            {pending.length === 1 ? "1 neuer Jahrgang wartet" : `${pending.length} neue Jahrgänge warten`} auf deine Freigabe.
          </p>
          <ul className="mt-2 flex flex-col gap-2">
            {pending.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-2">
                <Link href={`/plattform/jahrgang/${c.id}`} className="min-w-0 flex-1 break-words text-primary hover:underline">
                  {c.schoolName}
                  {c.city ? `, ${c.city}` : ""} · {c.name} ({c.members} {c.members === 1 ? "Account" : "Accounts"})
                </Link>
                <ActionForm action={approveCohort}>
                  <Hidden name="id" value={c.id} />
                  <SubmitButton size="sm" variant="success">
                    Freigeben
                  </SubmitButton>
                </ActionForm>
              </li>
            ))}
          </ul>
        </Notice>
      ) : null}

      <section aria-label="Kennzahlen" className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatTile label="Schulen" value={totals.schools} />
        <StatTile
          label="Jahrgänge"
          value={totals.cohorts}
          hint={[`${totals.cohortsActive} aktiv`, totals.cohortsPending ? `${totals.cohortsPending} wartend` : "", totals.cohortsLocked ? `${totals.cohortsLocked} gesperrt` : ""]
            .filter(Boolean)
            .join(" · ")}
        />
        <StatTile label="Mitglieder" value={totals.members} hint={`Ø ${totals.cohorts ? Math.round(totals.members / totals.cohorts) : 0} pro Jahrgang`} />
        <StatTile
          label="Eingeloggt (30 Tage)"
          value={totals.active30}
          hint={`${pct(totals.active30, totals.members)} % aller Mitglieder`}
        />
        <StatTile
          label="Neue Accounts (30 Tage)"
          value={totals.newMembers30}
          delta={{ value: totals.newMembers30 - totals.newMembersPrev30, period: "ggü. den 30 Tagen davor" }}
        />
        <StatTile label="Partner-Klicks (30 Tage)" value={totals.partnerClicks30} />
      </section>

      <Card>
        <CardContent className="pt-4 sm:pt-5">
          <WeeklyBars title="Neue Accounts pro Woche (letzte 12 Wochen)" data={weeks} unit={["Account", "Accounts"]} />
        </CardContent>
      </Card>

      <section>
        <SectionTitle>Jahrgänge ({cohorts.length})</SectionTitle>
        {cohorts.length === 0 ? (
          <EmptyState title="Noch keine Jahrgänge" />
        ) : (
          <>
            {/* Desktop: Tabelle */}
            <Card className="hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead className="border-b border-border text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2 font-medium">Schule / Jahrgang</th>
                    <th className="px-2 py-2 font-medium">Status</th>
                    <th className="px-2 py-2 text-right font-medium">Mitglieder</th>
                    <th className="px-2 py-2 text-right font-medium">Schon eingeloggt</th>
                    <th className="px-2 py-2 text-right font-medium">Aktiv 30 T.</th>
                    <th className="px-2 py-2 text-right font-medium">Termine</th>
                    <th className="px-2 py-2 text-right font-medium">Schicht-Anm.</th>
                    <th className="px-2 py-2 text-right font-medium">Spenden</th>
                    <th className="px-2 py-2 font-medium">Zuletzt aktiv</th>
                    <th className="px-2 py-2" aria-label="Details" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {cohorts.map((c) => (
                    <tr key={c.id} className="hover:bg-muted/50">
                      <td className="px-4 py-2.5">
                        <Link href={`/plattform/jahrgang/${c.id}`} className="block hover:text-primary">
                          <CohortName c={c} mine={c.id === me.cohort_id} />
                        </Link>
                      </td>
                      <td className="px-2 py-2.5">
                        <StatusBadge c={c} />
                      </td>
                      <td className="px-2 py-2.5 text-right font-medium tabular-nums">{c.members}</td>
                      <td className="px-2 py-2.5 text-right tabular-nums">
                        {c.everLoggedIn} <span className="text-xs text-muted-foreground">({pct(c.everLoggedIn, c.members)} %)</span>
                      </td>
                      <td className="px-2 py-2.5 text-right tabular-nums">{c.active30}</td>
                      <td className="px-2 py-2.5 text-right tabular-nums">{c.events}</td>
                      <td className="px-2 py-2.5 text-right tabular-nums">{c.signups}</td>
                      <td className="px-2 py-2.5 text-right tabular-nums">{c.pledges}</td>
                      <td className="px-2 py-2.5 text-xs whitespace-nowrap text-muted-foreground">{lastSeen(c.lastActivity)}</td>
                      <td className="px-2 py-2.5">
                        <Link href={`/plattform/jahrgang/${c.id}`} aria-label={`Details zu ${c.name}`} className="text-muted-foreground hover:text-primary">
                          <ChevronRight className="size-4" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>

            {/* Mobil: Karten */}
            <ul className="flex flex-col gap-2 md:hidden">
              {cohorts.map((c) => (
                <li key={c.id}>
                  <Link href={`/plattform/jahrgang/${c.id}`} className="block">
                    <Card className="transition-colors hover:border-primary/40">
                      <CardContent className="flex flex-col gap-2 pt-4 sm:pt-4">
                        <div className="flex items-start gap-2">
                          <div className="min-w-0 flex-1">
                            <CohortName c={c} mine={c.id === me.cohort_id} />
                          </div>
                          <StatusBadge c={c} />
                        </div>
                        <dl className="grid grid-cols-3 gap-2 text-center">
                          {[
                            { label: "Mitglieder", value: c.members },
                            { label: "eingeloggt", value: `${pct(c.everLoggedIn, c.members)} %` },
                            { label: "aktiv 30 T.", value: c.active30 },
                          ].map((s) => (
                            <div key={s.label} className="rounded-lg bg-muted px-1 py-1.5">
                              <dd className="font-semibold tabular-nums">{s.value}</dd>
                              <dt className="text-[11px] text-muted-foreground">{s.label}</dt>
                            </div>
                          ))}
                        </dl>
                        <p className="text-xs text-muted-foreground">
                          {c.events} Termine · {c.signups} Schicht-Anmeldungen · {c.pledges} Spenden · zuletzt aktiv {lastSeen(c.lastActivity)}
                        </p>
                      </CardContent>
                    </Card>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
        <p className="mt-2 text-xs text-muted-foreground">
          „Schon eingeloggt“ und „Aktiv“ beruhen auf dem letzten Login mit Passwort – wer dauerhaft eingeloggt bleibt, zählt ab
          seinem letzten Login. „Zuletzt aktiv“ = letzter Login, neuer Termin, Schicht-Anmeldung oder Spende.
        </p>
      </section>
    </div>
  );
}
