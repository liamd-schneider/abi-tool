import type { Metadata } from "next";
import Link from "next/link";
import { History } from "lucide-react";
import { StatTile } from "@/components/stat-tile";
import { Card } from "@/components/ui/card";
import { PageHeader, SectionTitle } from "@/components/ui/misc";
import { AUDIT_LABELS } from "@/lib/audit";
import { requirePlatformAdmin } from "@/lib/auth";
import { formatStamp, nowMs } from "@/lib/dates";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = { title: "Protokoll & Sicherheit" };

interface AuditRow {
  id: number;
  actor_name: string | null;
  action: string;
  target: string | null;
  created_at: string;
  cohort_id: string | null;
  cohorts: { name: string; schools: { name: string } | null } | null;
}

export default async function PlatformAuditPage() {
  await requirePlatformAdmin();
  const admin = createAdminClient();
  const day = new Date(nowMs() - 86_400_000).toISOString();
  const count = (scope: string) =>
    admin.from("rate_limits").select("id", { count: "exact", head: true }).like("key", `${scope}:%`).gte("created_at", day);

  const [{ data: auditData }, failed, logins, registrations, mfa] = await Promise.all([
    admin
      .from("audit_log")
      .select("id, actor_name, action, target, created_at, cohort_id, cohorts(name, schools(name))")
      .order("created_at", { ascending: false })
      .limit(100),
    count("login-fail"),
    count("login-ip"),
    count("register-ip"),
    count("mfa-verify"),
  ]);
  const rows = (auditData ?? []) as unknown as AuditRow[];

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Protokoll & Sicherheit" description="Wichtige Aktionen aller Jahrgänge und Login-Versuche." className="mb-0" />

      <section>
        <SectionTitle>Letzte 24 Stunden</SectionTitle>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile label="Login-Anfragen" value={logins.count ?? 0} />
          <StatTile label="Fehlgeschlagene Logins" value={failed.count ?? 0} hint="ohne späteren Erfolg" />
          <StatTile label="2FA-Prüfungen" value={mfa.count ?? 0} />
          <StatTile label="Registrierungsversuche" value={registrations.count ?? 0} />
        </div>
      </section>

      <section>
        <SectionTitle>
          <span className="inline-flex items-center gap-2">
            <History className="size-5 text-primary" /> Protokoll (letzte 100)
          </span>
        </SectionTitle>
        <Card>
          <ul className="divide-y divide-border">
            {rows.length === 0 ? <li className="px-4 py-3 text-sm text-muted-foreground">Noch keine Einträge.</li> : null}
            {rows.map((r) => (
              <li key={r.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 px-4 py-2 text-sm">
                <span className="w-28 shrink-0 text-xs text-muted-foreground tabular-nums">{formatStamp(r.created_at)}</span>
                <span className="min-w-0 flex-1 break-words">
                  <b>{AUDIT_LABELS[r.action] ?? r.action}</b>
                  {r.target ? <span className="text-muted-foreground"> · {r.target}</span> : null}
                </span>
                <span className="text-xs text-muted-foreground">
                  {r.actor_name ?? "System"}
                  {r.cohorts && r.cohort_id ? (
                    <>
                      {" · "}
                      <Link href={`/plattform/jahrgang/${r.cohort_id}`} className="text-primary hover:underline">
                        {r.cohorts.schools?.name ? `${r.cohorts.schools.name} · ` : ""}
                        {r.cohorts.name}
                      </Link>
                    </>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </section>
    </div>
  );
}
