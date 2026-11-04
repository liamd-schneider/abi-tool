import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check, Vote } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EmptyState, PageHeader, SectionTitle } from "@/components/ui/misc";
import { requireUser } from "@/lib/auth";
import { formatDateShort, formatDateTime, nowMs } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import type { Poll } from "@/lib/types";

export const metadata: Metadata = { title: "Abstimmungen" };

export default async function PollsPage() {
  const me = await requireUser();
  const supabase = await createClient();
  const [{ data: polls }, { data: votes }] = await Promise.all([
    supabase.from("polls").select("*").order("created_at", { ascending: false }).limit(100),
    supabase.from("poll_votes").select("poll_id").eq("user_id", me.id),
  ]);

  const now = nowMs();
  const voted = new Set((votes ?? []).map((v) => v.poll_id as string));
  const all = (polls ?? []) as Poll[];
  const isOpen = (p: Poll) => !p.closed && (!p.closes_at || new Date(p.closes_at).getTime() > now);
  const open = all.filter(isOpen);
  const done = all.filter((p) => !isOpen(p));

  const row = (p: Poll) => (
    <Link
      key={p.id}
      href={`/abstimmungen/${p.id}`}
      className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/40"
    >
      <Vote className="size-5 shrink-0 text-primary" />
      <div className="min-w-0 flex-1">
        <p className="font-medium">{p.question}</p>
        <p className="text-xs text-muted-foreground">
          {formatDateShort(p.created_at)}
          {p.closes_at && isOpen(p) ? ` · endet ${formatDateTime(p.closes_at)}` : ""}
          {p.anonymous ? " · anonym" : ""}
        </p>
      </div>
      {voted.has(p.id) ? (
        <Badge variant="success">
          <Check className="size-3" /> abgestimmt
        </Badge>
      ) : isOpen(p) ? (
        <Badge>offen</Badge>
      ) : null}
      <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
    </Link>
  );

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Abstimmungen" description="Stimm ab – die Ergebnisse siehst du sofort." />
      {all.length === 0 ? (
        <EmptyState icon={<Vote className="size-6" />} title="Noch keine Abstimmungen" />
      ) : (
        <>
          <section>
            <SectionTitle>Laufend</SectionTitle>
            {open.length === 0 ? (
              <p className="text-sm text-muted-foreground">Gerade läuft keine Abstimmung.</p>
            ) : (
              <div className="flex flex-col gap-2">{open.map(row)}</div>
            )}
          </section>
          {done.length > 0 ? (
            <section>
              <SectionTitle>Beendet</SectionTitle>
              <div className="flex flex-col gap-2 opacity-80">{done.map(row)}</div>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
