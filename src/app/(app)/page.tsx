import Link from "next/link";
import { ArrowRight, BellRing, Cake, CalendarDays, Clock, Megaphone, Pin, TriangleExclamationPoint, Vote } from "lucide-react";
import { Countdown } from "@/components/countdown";
import { PushPrompt } from "@/components/push";
import { pushPublicKey } from "@/lib/push";
import { DateBlock, LocationLink } from "@/components/event-bits";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, Multiline, Notice, SectionTitle } from "@/components/ui/misc";
import { requireUser } from "@/lib/auth";
import { formatDateLong, formatDateShort, formatDateTime, formatRange, formatTime, formatTimeRange, isUpcoming, nowMs, relativeDay } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import { firstName } from "@/lib/utils";

interface MyShift {
  shift_id: string;
  shifts: {
    id: string;
    title: string;
    starts_at: string;
    ends_at: string;
    event_id: string;
    events: { id: string; title: string; location_name: string | null; address: string | null; maps_url: string | null; published: boolean };
  };
}

interface OpenShift {
  id: string;
  title: string;
  starts_at: string;
  ends_at: string;
  capacity: number;
  event_id: string;
  events: { title: string };
  shift_signups: { user_id: string }[];
}

interface MyPledge {
  id: string;
  quantity: number;
  event_needs: { title: string; unit: string | null; event_id: string; events: { title: string; starts_at: string; ends_at: string | null } };
}

interface UpcomingEvent {
  id: string;
  title: string;
  starts_at: string;
  ends_at: string | null;
  location_name: string | null;
  address: string | null;
  maps_url: string | null;
}

const HOUR = 3_600_000;

export default async function DashboardPage() {
  const me = await requireUser();
  const supabase = await createClient();
  const now = nowMs();
  const nowStr = new Date(now).toISOString();
  const weekAgo = new Date(now - 7 * 24 * HOUR).toISOString();

  const [mySignupsRes, eventsRes, openShiftsRes, pollsRes, myVotesRes, newsRes, myPledgesRes] = await Promise.all([
    supabase
      .from("shift_signups")
      .select(
        "shift_id, shifts!inner(id, title, starts_at, ends_at, event_id, events!inner(id, title, location_name, address, maps_url, published))",
      )
      .eq("user_id", me.id)
      .gte("shifts.ends_at", nowStr),
    supabase
      .from("events")
      .select("id, title, starts_at, ends_at, location_name, address, maps_url")
      .eq("published", true)
      .gte("starts_at", weekAgo)
      .order("starts_at")
      .limit(30),
    supabase
      .from("shifts")
      .select("id, title, starts_at, ends_at, capacity, event_id, events!inner(title, published), shift_signups(user_id)")
      .eq("events.published", true)
      .gte("starts_at", nowStr)
      .order("starts_at")
      .limit(300),
    supabase.from("polls").select("id, question, closes_at, closed").eq("closed", false).order("created_at", { ascending: false }).limit(20),
    supabase.from("poll_votes").select("poll_id").eq("user_id", me.id),
    supabase
      .from("announcements")
      .select("id, title, body, pinned, created_at")
      .order("pinned", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(3),
    supabase
      .from("need_pledges")
      .select("id, quantity, event_needs!inner(title, unit, event_id, events!inner(title, starts_at, ends_at))")
      .eq("user_id", me.id),
  ]);

  const myShifts = ((mySignupsRes.data ?? []) as unknown as MyShift[])
    .filter((s) => s.shifts.events.published)
    .sort((a, b) => a.shifts.starts_at.localeCompare(b.shifts.starts_at));
  const nextShift = myShifts[0]?.shifts;
  const soonShifts = myShifts.filter((s) => new Date(s.shifts.starts_at).getTime() - now < 72 * HOUR);

  const events = ((eventsRes.data ?? []) as UpcomingEvent[]).filter((e) => isUpcoming(e.starts_at, e.ends_at, now)).slice(0, 4);

  const openShifts = ((openShiftsRes.data ?? []) as unknown as OpenShift[])
    .filter((s) => s.shift_signups.length < s.capacity && !s.shift_signups.some((x) => x.user_id === me.id))
    .slice(0, 5);

  const votedPollIds = new Set((myVotesRes.data ?? []).map((v) => v.poll_id as string));
  const openPolls = (pollsRes.data ?? []).filter(
    (p) => (!p.closes_at || new Date(p.closes_at).getTime() > now) && !votedPollIds.has(p.id),
  );

  const myPledges = ((myPledgesRes.data ?? []) as unknown as MyPledge[])
    .filter((p) => isUpcoming(p.event_needs.events.starts_at, p.event_needs.events.ends_at, now))
    .sort((a, b) => a.event_needs.events.starts_at.localeCompare(b.event_needs.events.starts_at));

  const news = newsRes.data ?? [];

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Hallo {firstName(me.full_name)}!</h1>
        <p className="mt-1 text-sm text-muted-foreground">{formatDateLong(nowStr)}</p>
      </div>

      <PushPrompt vapidKey={pushPublicKey()} />

      {/* Warnungen für bald anstehende eigene Schichten */}
      {soonShifts.length > 0 ? (
        <div className="flex flex-col gap-2">
          {soonShifts.map(({ shifts: s }) => {
            const urgent = new Date(s.starts_at).getTime() - now < 24 * HOUR;
            return (
              <Notice
                key={s.id}
                tone={urgent ? "danger" : "warning"}
                icon={
                  urgent ? (
                    <BellRing className="size-5 text-destructive" />
                  ) : (
                    <TriangleExclamationPoint className="size-5 text-warning-foreground" />
                  )
                }
              >
                <p className="font-semibold">
                  {urgent ? "Gleich geht’s los: " : "Bald dran: "}„{s.title}“ – {s.events.title}
                </p>
                <p className="text-muted-foreground">
                  {relativeDay(s.starts_at, now)} um {formatTime(s.starts_at)} Uhr · noch{" "}
                  <span className="font-semibold text-foreground">
                    <Countdown target={s.starts_at} compact />
                  </span>
                </p>
                <Link href={`/termine/${s.event_id}`} className="mt-1 inline-block font-medium text-primary hover:underline">
                  Details ansehen →
                </Link>
              </Notice>
            );
          })}
        </div>
      ) : null}

      {/* Nächste eigene Schicht + eigene Einträge */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card className="overflow-hidden md:col-span-3">
          {nextShift ? (
            <div className="flex h-full flex-col gap-4 bg-linear-to-br from-primary to-primary/80 p-5 text-primary-foreground">
              <div className="flex items-center gap-2 text-sm font-medium opacity-90">
                <Clock className="size-4" /> Deine nächste Schicht
              </div>
              <div>
                <p className="text-xl font-bold">{nextShift.title}</p>
                <p className="opacity-90">
                  {nextShift.events.title} · {formatDateShort(nextShift.starts_at)},{" "}
                  {formatTimeRange(nextShift.starts_at, nextShift.ends_at)} Uhr
                </p>
              </div>
              <div className="text-3xl font-bold sm:text-4xl">
                <Countdown target={nextShift.starts_at} />
              </div>
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <LocationLink
                  locationName={nextShift.events.location_name}
                  address={nextShift.events.address}
                  customMapsUrl={nextShift.events.maps_url}
                  className="opacity-95 [&_svg]:text-primary-foreground/80"
                />
                <Link
                  href={`/termine/${nextShift.event_id}`}
                  className="ml-auto inline-flex items-center gap-1 font-semibold underline-offset-2 hover:underline"
                >
                  Zum Termin <ArrowRight className="size-4" />
                </Link>
              </div>
            </div>
          ) : (
            <CardContent className="flex h-full flex-col items-start justify-center gap-3 pt-5">
              <p className="font-semibold">Du bist noch für keine Schicht eingetragen.</p>
              <p className="text-sm text-muted-foreground">Schau mal, wo noch Leute gebraucht werden.</p>
              <Link href="/schichten" className={buttonVariants({ size: "sm" })}>
                Schichten ansehen
              </Link>
            </CardContent>
          )}
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Deine Einträge</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            {myShifts.length === 0 && myPledges.length === 0 ? (
              <p className="text-muted-foreground">Noch nichts eingetragen.</p>
            ) : null}
            {myShifts.slice(0, 4).map(({ shifts: s }) => (
              <Link key={s.id} href={`/termine/${s.event_id}`} className="flex items-center gap-2 rounded-lg p-1.5 hover:bg-muted">
                <Clock className="size-4 shrink-0 text-primary" />
                <span className="min-w-0 flex-1 truncate">
                  {s.title} <span className="text-muted-foreground">· {s.events.title}</span>
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">{formatDateShort(s.starts_at)}</span>
              </Link>
            ))}
            {myPledges.slice(0, 4).map((p) => (
              <Link
                key={p.id}
                href={`/termine/${p.event_needs.event_id}`}
                className="flex items-center gap-2 rounded-lg p-1.5 hover:bg-muted"
              >
                <Cake className="size-4 shrink-0 text-primary" />
                <span className="min-w-0 flex-1 truncate">
                  {p.quantity}× {p.event_needs.title} <span className="text-muted-foreground">· {p.event_needs.events.title}</span>
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">{formatDateShort(p.event_needs.events.starts_at)}</span>
              </Link>
            ))}
            {myShifts.length + myPledges.length > 8 ? (
              <Link href="/schichten?filter=meine" className="text-xs font-medium text-primary hover:underline">
                Alle anzeigen →
              </Link>
            ) : null}
          </CardContent>
        </Card>
      </div>

      {/* Offene Abstimmungen */}
      {openPolls.length > 0 ? (
        <section>
          <SectionTitle>Deine Stimme fehlt noch</SectionTitle>
          <div className="grid gap-3 sm:grid-cols-2">
            {openPolls.slice(0, 4).map((p) => (
              <Link
                key={p.id}
                href={`/abstimmungen/${p.id}`}
                className="flex items-center gap-3 rounded-xl border border-primary/30 bg-primary-soft p-4 transition-colors hover:border-primary"
              >
                <Vote className="size-5 shrink-0 text-primary" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{p.question}</p>
                  {p.closes_at ? (
                    <p className="text-xs text-muted-foreground">endet {formatDateTime(p.closes_at)}</p>
                  ) : null}
                </div>
                <ArrowRight className="size-4 shrink-0 text-primary" />
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Nächste Termine */}
        <section>
          <SectionTitle
            action={
              <Link href="/termine" className="text-sm font-medium text-primary hover:underline">
                Alle
              </Link>
            }
          >
            Nächste Termine
          </SectionTitle>
          {events.length === 0 ? (
            <EmptyState icon={<CalendarDays className="size-6" />} title="Keine anstehenden Termine" />
          ) : (
            <div className="flex flex-col gap-2">
              {events.map((e) => (
                <Link
                  key={e.id}
                  href={`/termine/${e.id}`}
                  className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 transition-colors hover:border-primary/40"
                >
                  <DateBlock iso={e.starts_at} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{e.title}</p>
                    <p className="text-sm text-muted-foreground">{formatRange(e.starts_at, e.ends_at)}</p>
                    {e.location_name ? <p className="truncate text-xs text-muted-foreground">{e.location_name}</p> : null}
                  </div>
                  <Badge variant="muted">{relativeDay(e.starts_at, now)}</Badge>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Hier fehlen noch Leute */}
        <section>
          <SectionTitle
            action={
              <Link href="/schichten?filter=frei" className="text-sm font-medium text-primary hover:underline">
                Alle freien
              </Link>
            }
          >
            Hier werden noch Leute gebraucht
          </SectionTitle>
          {openShifts.length === 0 ? (
            <EmptyState icon={<Clock className="size-6" />} title="Alle Schichten sind besetzt">
              Danke an alle!
            </EmptyState>
          ) : (
            <div className="flex flex-col gap-2">
              {openShifts.map((s) => {
                const free = s.capacity - s.shift_signups.length;
                return (
                  <Link
                    key={s.id}
                    href={`/termine/${s.event_id}#schichten`}
                    className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 transition-colors hover:border-primary/40"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">
                        {s.title} <span className="text-muted-foreground">· {s.events.title}</span>
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {formatDateShort(s.starts_at)}, {formatTimeRange(s.starts_at, s.ends_at)} Uhr
                      </p>
                    </div>
                    <Badge variant={free === 1 ? "warning" : "default"}>{free} frei</Badge>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* Neuigkeiten */}
      <section>
        <SectionTitle
          action={
            <Link href="/neuigkeiten" className="text-sm font-medium text-primary hover:underline">
              Alle
            </Link>
          }
        >
          Neuigkeiten
        </SectionTitle>
        {news.length === 0 ? (
          <EmptyState icon={<Megaphone className="size-6" />} title="Noch keine Neuigkeiten" />
        ) : (
          <div className="grid gap-3 md:grid-cols-3">
            {news.map((n) => (
              <Card key={n.id}>
                <CardHeader>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {n.pinned ? <Pin className="size-3.5 text-primary" /> : null}
                    {formatDateShort(n.created_at)}
                  </div>
                  <CardTitle>{n.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <Multiline text={n.body} className="line-clamp-4 text-sm text-muted-foreground" />
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
