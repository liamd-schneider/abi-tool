import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AutoRefresh } from "@/components/auto-refresh";
import { PollVoter, type PollVoterOption } from "@/components/poll-voter";
import { Card, CardContent } from "@/components/ui/card";
import { Multiline } from "@/components/ui/misc";
import { requireUser } from "@/lib/auth";
import { formatDateTime, nowMs } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import type { Poll, PollOption } from "@/lib/types";

export const metadata: Metadata = { title: "Abstimmung" };

export default async function PollPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await requireUser();
  const supabase = await createClient();

  const [{ data: poll }, { data: options }, { data: results }, { data: votes }] = await Promise.all([
    supabase.from("polls").select("*").eq("id", id).maybeSingle(),
    supabase.from("poll_options").select("*").eq("poll_id", id).order("sort_order"),
    supabase.rpc("poll_results", { p_poll_id: id }),
    supabase.from("poll_votes").select("option_id, user_id, profiles(full_name)").eq("poll_id", id).order("created_at"),
  ]);

  if (!poll) notFound();
  const p = poll as Poll;

  const counts = new Map<string, number>();
  let totalVoters = 0;
  for (const r of (results ?? []) as { option_id: string; votes: number; voters: number }[]) {
    counts.set(r.option_id, Number(r.votes));
    totalVoters = Number(r.voters);
  }

  const voteRows = (votes ?? []) as unknown as { option_id: string; user_id: string; profiles: { full_name: string } | null }[];
  const myVotes = voteRows.filter((v) => v.user_id === me.id).map((v) => v.option_id);

  const voterOptions: PollVoterOption[] = ((options ?? []) as PollOption[]).map((o) => ({
    id: o.id,
    label: o.label,
    votes: counts.get(o.id) ?? 0,
    voters: p.anonymous
      ? []
      : voteRows.filter((v) => v.option_id === o.id).map((v) => v.profiles?.full_name ?? "Unbekannt"),
  }));

  const closed = p.closed || (p.closes_at !== null && new Date(p.closes_at).getTime() < nowMs());

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      {!closed ? <AutoRefresh seconds={15} /> : null}
      <Link href="/abstimmungen" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Alle Abstimmungen
      </Link>
      <Card>
        <CardContent className="flex flex-col gap-4 pt-5 sm:pt-6">
          <div>
            <h1 className="text-xl font-bold tracking-tight sm:text-2xl">{p.question}</h1>
            {p.description ? <Multiline text={p.description} className="mt-1 text-sm text-muted-foreground" /> : null}
            {p.closes_at ? (
              <p className="mt-1 text-xs text-muted-foreground">
                {closed ? "Beendet am" : "Läuft bis"} {formatDateTime(p.closes_at)}
              </p>
            ) : null}
          </div>
          <PollVoter
            pollId={p.id}
            options={voterOptions}
            myVotes={myVotes}
            totalVoters={totalVoters}
            allowMultiple={p.allow_multiple}
            closed={closed}
            anonymous={p.anonymous}
          />
        </CardContent>
      </Card>
    </div>
  );
}
