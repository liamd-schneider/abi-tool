import type { Metadata } from "next";
import { History } from "lucide-react";
import { Card } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { AUDIT_LABELS } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth";
import { formatStamp } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Protokoll" };

interface AuditRow {
  id: number;
  actor_name: string | null;
  action: string;
  target: string | null;
  created_at: string;
}

export default async function AuditPage() {
  const me = await requireAdmin();
  const supabase = await createClient();
  // RLS: Admins sehen nur das Protokoll des eigenen Jahrgangs
  const { data } = await supabase
    .from("audit_log")
    .select("id, actor_name, action, target, created_at")
    .eq("cohort_id", me.cohort_id)
    .order("created_at", { ascending: false })
    .limit(200);
  const rows = (data ?? []) as AuditRow[];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Protokoll"
        description="Sicherheitsrelevante Aktionen in eurem Jahrgang – wer hat wann was geändert. Einträge werden nach gut einem Jahr gelöscht."
        className="mb-0"
      />
      {rows.length === 0 ? (
        <EmptyState icon={<History className="size-6" />} title="Noch keine Einträge" />
      ) : (
        <Card>
          <ul className="divide-y divide-border">
            {rows.map((r) => (
              <li key={r.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 px-4 py-2.5 text-sm">
                <span className="w-28 shrink-0 text-xs text-muted-foreground tabular-nums">{formatStamp(r.created_at)}</span>
                <span className="min-w-0 flex-1">
                  <b>{AUDIT_LABELS[r.action] ?? r.action}</b>
                  {r.target ? <span className="text-muted-foreground"> · {r.target}</span> : null}
                </span>
                <span className="text-xs text-muted-foreground">{r.actor_name ?? "System"}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
