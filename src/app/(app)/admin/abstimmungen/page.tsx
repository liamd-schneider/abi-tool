import type { Metadata } from "next";
import Link from "next/link";
import { Trash } from "lucide-react";
import { ActionForm, Hidden, SubmitButton } from "@/components/action-form";
import { PollForm } from "@/components/admin/poll-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, PageHeader, SectionTitle } from "@/components/ui/misc";
import { Progress } from "@/components/ui/progress";
import { deletePoll, setPollClosed } from "@/actions/admin";
import { formatDateTime, formatStamp, nowMs } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import type { Poll, PollOption } from "@/lib/types";

export const metadata: Metadata = { title: "Abstimmungen verwalten" };

export default async function AdminPollsPage() {
  const supabase = await createClient();
  const [{ data: pollData }, { data: optionData }, { count: memberCount }] = await Promise.all([
    supabase.from("polls").select("*").order("created_at", { ascending: false }).limit(50),
    supabase.from("poll_options").select("*").order("sort_order"),
    supabase.from("profiles").select("id", { count: "exact", head: true }),
  ]);
  const polls = (pollData ?? []) as Poll[];
  const options = (optionData ?? []) as PollOption[];

  const results = await Promise.all(
    polls.map(async (p) => {
      const { data } = await supabase.rpc("poll_results", { p_poll_id: p.id });
      return [p.id, (data ?? []) as { option_id: string; votes: number; voters: number }[]] as const;
    }),
  );
  const resultMap = new Map(results);
  const now = nowMs();

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Abstimmungen" description="Wie bei WhatsApp: Frage stellen, Optionen festlegen, fertig." className="mb-0" />

      <Card>
        <CardHeader>
          <CardTitle>Neue Abstimmung</CardTitle>
        </CardHeader>
        <CardContent>
          <PollForm />
        </CardContent>
      </Card>

      <section>
        <SectionTitle>Alle Abstimmungen</SectionTitle>
        {polls.length === 0 ? (
          <EmptyState title="Noch keine Abstimmungen" />
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {polls.map((p) => {
              const rows = resultMap.get(p.id) ?? [];
              const voters = Number(rows[0]?.voters ?? 0);
              const expired = p.closes_at !== null && new Date(p.closes_at).getTime() < now;
              const open = !p.closed && !expired;
              const opts = options.filter((o) => o.poll_id === p.id);
              return (
                <Card key={p.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between gap-2">
                      <Link href={`/abstimmungen/${p.id}`} className="hover:underline">
                        <CardTitle>{p.question}</CardTitle>
                      </Link>
                      {open ? <Badge variant="success">läuft</Badge> : <Badge variant="muted">beendet</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {formatStamp(p.created_at)} · {p.allow_multiple ? "Mehrfachwahl" : "Einzelwahl"}
                      {p.anonymous ? " · anonym" : ""}
                      {p.closes_at ? ` · ${expired ? "endete" : "endet"} ${formatDateTime(p.closes_at)}` : ""}
                    </p>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-3">
                    <div className="flex flex-col gap-2">
                      {opts.map((o) => {
                        const votes = Number(rows.find((r) => r.option_id === o.id)?.votes ?? 0);
                        return (
                          <div key={o.id} className="text-sm">
                            <div className="flex justify-between gap-2">
                              <span className="truncate">{o.label}</span>
                              <span className="tabular-nums text-muted-foreground">{votes}</span>
                            </div>
                            <Progress value={votes} max={Math.max(voters, 1)} />
                          </div>
                        );
                      })}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {voters} von {memberCount ?? "?"} haben abgestimmt
                    </p>
                    <div className="flex flex-wrap gap-2 border-t border-border pt-3">
                      {!expired ? (
                        <ActionForm action={setPollClosed}>
                          <Hidden name="id" value={p.id} />
                          <Hidden name="closed" value={!p.closed} />
                          <SubmitButton variant="outline" size="sm">
                            {p.closed ? "Wieder öffnen" : "Beenden"}
                          </SubmitButton>
                        </ActionForm>
                      ) : null}
                      <ActionForm action={deletePoll} confirm="Abstimmung mit allen Stimmen löschen?">
                        <Hidden name="id" value={p.id} />
                        <SubmitButton variant="destructive-ghost" size="sm">
                          <Trash className="size-4" /> Löschen
                        </SubmitButton>
                      </ActionForm>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
