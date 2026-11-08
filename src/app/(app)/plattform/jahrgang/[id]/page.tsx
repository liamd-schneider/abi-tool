import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, KeyRound, Link2, ShieldCheck, ShieldOff } from "lucide-react";
import { ActionForm, Hidden, SubmitButton } from "@/components/action-form";
import { CopyButton } from "@/components/copy-button";
import { StatTile } from "@/components/stat-tile";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader, SectionTitle } from "@/components/ui/misc";
import { approveCohort, setCohortActive } from "@/actions/platform";
import { AUDIT_LABELS } from "@/lib/audit";
import { requirePlatformAdmin } from "@/lib/auth";
import { formatDate, formatDateTime, formatStamp, nowIso, relativeDay } from "@/lib/dates";
import { loadPlatformStats } from "@/lib/platform-stats";
import { getOrigin } from "@/lib/request";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = { title: "Jahrgang · System-Admin" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const pct = (part: number, total: number) => (total > 0 ? Math.round((part / total) * 100) : 0);

export default async function PlatformCohortPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requirePlatformAdmin();
  const { id } = await params;
  if (!UUID.test(id)) notFound();

  const { cohorts, profiles, lastSignIns } = await loadPlatformStats();
  const c = cohorts.find((x) => x.id === id);
  if (!c) notFound();

  const admin = createAdminClient();
  const adminProfiles = profiles.filter((p) => p.cohort_id === id && p.role === "admin").sort((a, b) => a.full_name.localeCompare(b.full_name, "de"));
  const [{ data: eventData }, { data: auditData }, adminUsers] = await Promise.all([
    admin.from("events").select("id, title, starts_at, published").eq("cohort_id", id).gte("starts_at", nowIso()).order("starts_at").limit(5),
    admin.from("audit_log").select("id, actor_name, action, target, created_at").eq("cohort_id", id).order("created_at", { ascending: false }).limit(25),
    Promise.all(adminProfiles.map((p) => admin.auth.admin.getUserById(p.id))),
  ]);
  const mfaOf = new Map(
    adminUsers.map((r, i) => [adminProfiles[i].id, r.data.user?.factors?.some((f) => f.status === "verified") ?? false] as const),
  );
  const events = (eventData ?? []) as { id: string; title: string; starts_at: string; published: boolean }[];
  const audit = (auditData ?? []) as { id: number; actor_name: string | null; action: string; target: string | null; created_at: string }[];
  const loginLink = `${await getOrigin()}/j/${c.slug}`;
  const mine = c.id === me.cohort_id;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Link href="/plattform" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> Alle Schulen
        </Link>
        <PageHeader
          title={`${c.schoolName}${c.city ? `, ${c.city}` : ""}`}
          description={`${c.name} · registriert am ${formatDate(c.created_at)}${mine ? " · dein Jahrgang" : ""}`}
          className="mb-0"
        />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {c.pending ? <Badge variant="warning">wartet auf Freigabe</Badge> : c.active ? <Badge variant="success">aktiv</Badge> : <Badge variant="destructive">gesperrt</Badge>}
          {c.require_admin_2fa ? <Badge variant="muted">2FA-Pflicht für Admins</Badge> : null}
          <span className="flex-1" />
          {c.pending ? (
            <ActionForm action={approveCohort}>
              <Hidden name="id" value={c.id} />
              <SubmitButton size="sm" variant="success">
                Freigeben
              </SubmitButton>
            </ActionForm>
          ) : null}
          {!mine ? (
            <ActionForm
              action={setCohortActive}
              confirm={c.active ? `„${c.name}“ sperren? Niemand aus dem Jahrgang kommt dann noch rein.` : undefined}
            >
              <Hidden name="id" value={c.id} />
              <Hidden name="active" value={!c.active} />
              <SubmitButton size="sm" variant={c.active ? "destructive-ghost" : "outline"}>
                {c.active ? "Sperren" : "Entsperren"}
              </SubmitButton>
            </ActionForm>
          ) : null}
        </div>
      </div>

      <section aria-label="Kennzahlen" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Mitglieder" value={c.members} hint={c.newMembers30 ? `+${c.newMembers30} in 30 Tagen` : undefined} />
        <StatTile label="Schon eingeloggt" value={c.everLoggedIn} hint={`${pct(c.everLoggedIn, c.members)} % der Mitglieder`} />
        <StatTile label="Eingeloggt (30 Tage)" value={c.active30} />
        <StatTile label="Admins" value={c.admins} />
        <StatTile label="Termine" value={c.events} hint={`${c.shifts} Schichten`} />
        <StatTile label="Schicht-Anmeldungen" value={c.signups} />
        <StatTile label="Spenden" value={c.pledges} hint={`${c.polls} Abstimmungen`} />
        <StatTile label="Push-Geräte" value={c.pushDevices} hint={`${c.partnerClicks30} Partner-Klicks / 30 T.`} />
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Zugang</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            <div>
              <p className="mb-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
                <Link2 className="size-3.5" /> Login-Link
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <code className="min-w-0 rounded-md bg-muted px-2 py-1 text-xs break-all">{loginLink}</code>
                <CopyButton text={loginLink} size="sm" variant="ghost" />
              </div>
            </div>
            <div>
              <p className="mb-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
                <KeyRound className="size-3.5" /> Jahrgangs-Code
              </p>
              <div className="flex items-center gap-2">
                <code className="rounded-md bg-muted px-2 py-1 font-mono font-bold tracking-widest">{c.join_code}</code>
                <CopyButton text={c.join_code} size="sm" variant="ghost" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Admins & Ansprechpartner ({adminProfiles.length})</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <ul className="divide-y divide-border text-sm">
              {adminProfiles.map((p) => {
                const login = lastSignIns.get(p.id) ?? null;
                return (
                  <li key={p.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium break-words">{p.full_name}</p>
                      <p className="text-xs text-muted-foreground">
                        @{p.username} · {login ? `Login ${relativeDay(login)}` : "noch nie eingeloggt"}
                      </p>
                    </div>
                    {mfaOf.get(p.id) ? (
                      <Badge variant="success">
                        <ShieldCheck className="size-3" /> 2FA
                      </Badge>
                    ) : (
                      <Badge variant="muted">
                        <ShieldOff className="size-3" /> ohne 2FA
                      </Badge>
                    )}
                  </li>
                );
              })}
              {adminProfiles.length === 0 ? <li className="py-2 text-muted-foreground">Keine Admins.</li> : null}
            </ul>
          </CardContent>
        </Card>
      </div>

      <section>
        <SectionTitle>Nächste Termine</SectionTitle>
        <Card>
          <ul className="divide-y divide-border text-sm">
            {events.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 px-4 py-2">
                <span className="w-36 shrink-0 text-xs text-muted-foreground tabular-nums">{formatDateTime(e.starts_at)}</span>
                <span className="min-w-0 flex-1 break-words">{e.title}</span>
                {e.published ? null : <Badge variant="muted">Entwurf</Badge>}
              </li>
            ))}
            {events.length === 0 ? <li className="px-4 py-3 text-muted-foreground">Keine anstehenden Termine.</li> : null}
          </ul>
        </Card>
      </section>

      <section>
        <SectionTitle>Protokoll des Jahrgangs</SectionTitle>
        <Card>
          <ul className="divide-y divide-border">
            {audit.length === 0 ? <li className="px-4 py-3 text-sm text-muted-foreground">Noch keine Einträge.</li> : null}
            {audit.map((r) => (
              <li key={r.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 px-4 py-2 text-sm">
                <span className="w-28 shrink-0 text-xs text-muted-foreground tabular-nums">{formatStamp(r.created_at)}</span>
                <span className="min-w-0 flex-1 break-words">
                  <b>{AUDIT_LABELS[r.action] ?? r.action}</b>
                  {r.target ? <span className="text-muted-foreground"> · {r.target}</span> : null}
                </span>
                <span className="text-xs text-muted-foreground">{r.actor_name ?? "System"}</span>
              </li>
            ))}
          </ul>
        </Card>
      </section>
    </div>
  );
}
