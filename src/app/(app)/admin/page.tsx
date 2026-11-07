import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, Cake, Clock, LogIn, Plus, ShoppingCart, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, EmptyState, PageHeader, PersonChip, SectionTitle } from "@/components/ui/misc";
import { SetupChecklist } from "@/components/admin/setup-checklist";
import { getAal, getCurrentCohort, requireAdmin } from "@/lib/auth";
import { formatDateShort, formatRange, formatStamp, formatTimeRange, isUpcoming, nowMs, relativeDay } from "@/lib/dates";
import { loadLastSignIns } from "@/lib/login-status";
import { Progress } from "@/components/ui/progress";
import { loadMemberStats } from "@/lib/stats";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Admin" };

/** Pro Termin höchstens so viele offene Schichten bzw. Bedarfe in der Übersicht zeigen */
const MAX_GAP_ROWS = 5;

interface OverviewEvent {
  id: string;
  title: string;
  starts_at: string;
  ends_at: string | null;
  published: boolean;
  shifts: { id: string; title: string; starts_at: string; ends_at: string; capacity: number; shift_signups: { user_id: string }[] }[];
  event_needs: { id: string; title: string; unit: string | null; quantity_needed: number; need_pledges: { quantity: number }[] }[];
  shopping_items: { bought_at: string | null }[];
}

interface Activity {
  key: string;
  at: string;
  who: string;
  what: string;
  eventId: string;
}

export default async function AdminOverviewPage() {
  const me = await requireAdmin();
  const [cohort, aal] = await Promise.all([getCurrentCohort(), getAal()]);
  const supabase = await createClient();
  const now = nowMs();
  const weekAgo = new Date(now - 7 * 86_400_000).toISOString();
  const head = { count: "exact", head: true } as const;

  const [allEvents, publishedEvents, allShifts, allNews, allPolls, myPush] = await Promise.all([
    supabase.from("events").select("id", head),
    supabase.from("events").select("id", head).eq("published", true),
    supabase.from("shifts").select("id", head),
    supabase.from("announcements").select("id", head),
    supabase.from("polls").select("id", head),
    supabase.from("push_subscriptions").select("id", head).eq("user_id", me.id),
  ]);

  const [eventsRes, signupsRes, pledgesRes, stats, lastSignIns] = await Promise.all([
    supabase
      .from("events")
      .select(
        "id, title, starts_at, ends_at, published, shifts(id, title, starts_at, ends_at, capacity, shift_signups(user_id)), event_needs(id, title, unit, quantity_needed, need_pledges(quantity)), shopping_items(bought_at)",
      )
      .gte("starts_at", weekAgo)
      .order("starts_at")
      .limit(50),
    supabase
      .from("shift_signups")
      .select("shift_id, user_id, created_at, profiles(full_name), shifts(title, event_id, events(title))")
      .order("created_at", { ascending: false })
      .limit(15),
    supabase
      .from("need_pledges")
      .select("id, quantity, created_at, profiles(full_name), event_needs(title, unit, event_id, events(title))")
      .order("created_at", { ascending: false })
      .limit(15),
    loadMemberStats(supabase),
    loadLastSignIns(),
  ]);

  const events = ((eventsRes.data ?? []) as unknown as OverviewEvent[]).filter((e) => isUpcoming(e.starts_at, e.ends_at, now));

  let freeSlots = 0;
  let missingItems = 0;
  const gaps = events
    .map((e) => {
      const shifts = e.shifts
        .filter((s) => s.shift_signups.length < s.capacity && new Date(s.ends_at).getTime() > now)
        .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
      const needs = e.event_needs.filter((n) => n.need_pledges.reduce((s, p) => s + p.quantity, 0) < n.quantity_needed);
      shifts.forEach((s) => (freeSlots += s.capacity - s.shift_signups.length));
      needs.forEach((n) => (missingItems += n.quantity_needed - n.need_pledges.reduce((s, p) => s + p.quantity, 0)));
      const openShopping = e.shopping_items.filter((i) => !i.bought_at).length;
      return { event: e, shifts, needs, openShopping };
    })
    .filter((g) => g.shifts.length > 0 || g.needs.length > 0 || g.openShopping > 0);

  type SignupActivity = {
    shift_id: string;
    user_id: string;
    created_at: string;
    profiles: { full_name: string } | null;
    shifts: { title: string; event_id: string; events: { title: string } | null } | null;
  };
  type PledgeActivity = {
    id: string;
    quantity: number;
    created_at: string;
    profiles: { full_name: string } | null;
    event_needs: { title: string; unit: string | null; event_id: string; events: { title: string } | null } | null;
  };

  const activity: Activity[] = [
    ...((signupsRes.data ?? []) as unknown as SignupActivity[]).map((s) => ({
      key: `s-${s.shift_id}-${s.user_id}`,
      at: s.created_at,
      who: s.profiles?.full_name ?? "?",
      what: `Schicht „${s.shifts?.title}“ · ${s.shifts?.events?.title ?? ""}`,
      eventId: s.shifts?.event_id ?? "",
    })),
    ...((pledgesRes.data ?? []) as unknown as PledgeActivity[]).map((p) => ({
      key: `p-${p.id}`,
      at: p.created_at,
      who: p.profiles?.full_name ?? "?",
      what: `${p.quantity} ${p.event_needs?.unit ?? "×"} ${p.event_needs?.title} · ${p.event_needs?.events?.title ?? ""}`,
      eventId: p.event_needs?.event_id ?? "",
    })),
  ]
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 15);

  const checklist = [
    {
      label: "Schule & Jahrgang prüfen",
      hint: "Schulname, Ort und Abi-Jahr – so erscheint ihr beim Login.",
      href: "/admin/jahrgang",
      done: Boolean(cohort?.schools && cohort.schools.name !== "Unsere Schule"),
    },
    {
      label: "Mitglieder anlegen",
      hint: "Namensliste einfügen – Zugangsdaten werden automatisch erzeugt.",
      href: "/admin/mitglieder",
      done: stats.some((s) => s.role === "member"),
    },
    {
      label: "Ersten Termin anlegen",
      hint: "Titel, Zeit, Ort – erst mal als Entwurf.",
      href: "/admin/termine/neu",
      done: (allEvents.count ?? 0) > 0,
    },
    {
      label: "Schichten für einen Termin anlegen",
      hint: "Einzeln oder als Schichtblöcke.",
      href: "/admin/termine",
      done: (allShifts.count ?? 0) > 0,
    },
    {
      label: "Termin veröffentlichen",
      hint: "Erst dann sehen ihn alle und werden benachrichtigt.",
      href: "/admin/termine",
      done: (publishedEvents.count ?? 0) > 0,
    },
    {
      label: "Neuigkeit oder Abstimmung erstellen",
      hint: "z. B. „Willkommen im Abi-Tool!“",
      href: "/admin/neuigkeiten",
      done: (allNews.count ?? 0) + (allPolls.count ?? 0) > 0,
    },
    {
      label: "Zwei-Faktor-Anmeldung für dich aktivieren",
      hint: "Empfohlen für alle Admins – schützt euren Jahrgang, falls dein Passwort bekannt wird.",
      href: "/profil#sicherheit",
      done: aal.next === "aal2",
    },
    {
      label: "Push auf deinem Handy aktivieren",
      hint: "Unter Profil – damit du kurzfristige Abmeldungen sofort mitbekommst.",
      href: "/profil",
      done: (myPush.count ?? 0) > 0,
    },
  ];

  const inactive = stats.filter((s) => s.shiftsTotal === 0 && s.pledges === 0);
  const neverLoggedIn = stats.filter((s) => !lastSignIns.get(s.id));
  const loggedIn = stats.length - neverLoggedIn.length;
  const drafts = events.filter((e) => !e.published).length;

  const tiles = [
    { label: "Mitglieder", value: stats.length, icon: Users, href: "/admin/mitglieder" },
    { label: "Kommende Termine", value: events.length, icon: CalendarDays, href: "/admin/termine", sub: drafts ? `${drafts} Entwurf` : undefined },
    { label: "Freie Schichtplätze", value: freeSlots, icon: Clock, href: "#fehlt" },
    { label: "Fehlende Spenden", value: missingItems, icon: Cake, href: "#fehlt" },
  ];

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Übersicht"
        description="Wer hat sich wo eingetragen – und wo fehlt noch was?"
        actions={
          <Link href="/admin/termine/neu" className={buttonVariants({ size: "sm" })}>
            <Plus className="size-4" /> Neuer Termin
          </Link>
        }
        className="mb-0"
      />

      <SetupChecklist items={checklist} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map(({ label, value, icon: Icon, href, sub }) => (
          <Link key={label} href={href}>
            <Card className="h-full transition-colors hover:border-primary/40">
              <CardContent className="flex items-center gap-3 pt-4 sm:pt-4">
                <span className="flex size-10 items-center justify-center rounded-lg bg-primary-soft text-primary">
                  <Icon className="size-5" />
                </span>
                <div>
                  <p className="text-2xl font-bold tabular-nums">{value}</p>
                  <p className="text-xs text-muted-foreground">
                    {label}
                    {sub ? ` · ${sub}` : ""}
                  </p>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <section id="logins" className="scroll-mt-20">
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-2">
                <LogIn className="size-4 text-primary" /> Schon eingeloggt: {loggedIn} von {stats.length}
              </CardTitle>
              <Link href="/admin/mitglieder?filter=nie" className="text-sm font-medium text-primary hover:underline">
                Details
              </Link>
            </div>
            <Progress value={loggedIn} max={stats.length} className="mt-2" />
          </CardHeader>
          <CardContent>
            {neverLoggedIn.length === 0 ? (
              <p className="text-sm text-muted-foreground">Alle haben sich mindestens einmal eingeloggt.</p>
            ) : (
              <details open={neverLoggedIn.length <= 20}>
                <summary className="cursor-pointer text-sm font-medium select-none">
                  Noch nie eingeloggt ({neverLoggedIn.length})
                </summary>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {neverLoggedIn.map((s) => (
                    <PersonChip key={s.id} name={s.full_name} />
                  ))}
                </div>
              </details>
            )}
          </CardContent>
        </Card>
      </section>

      <section id="fehlt" className="scroll-mt-20">
        <SectionTitle>Hier fehlt noch was</SectionTitle>
        {gaps.length === 0 ? (
          <EmptyState title="Alles abgedeckt – nichts offen." />
        ) : (
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {gaps.map(({ event, shifts, needs, openShopping }) => (
              <Card key={event.id}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <Link href={`/admin/termine/${event.id}`} className="min-w-0 hover:underline">
                      <CardTitle className="break-words">{event.title}</CardTitle>
                    </Link>
                    <div className="flex shrink-0 flex-wrap justify-end gap-1">
                      {!event.published ? <Badge variant="warning">Entwurf</Badge> : null}
                      <Badge variant="muted">{relativeDay(event.starts_at, now)}</Badge>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">{formatRange(event.starts_at, event.ends_at)}</p>
                </CardHeader>
                <CardContent className="flex flex-col gap-1.5 text-sm">
                  {shifts.slice(0, MAX_GAP_ROWS).map((s) => (
                    <div key={s.id} className="flex items-center gap-2">
                      <Clock className="size-3.5 shrink-0 text-muted-foreground" />
                      <span className="min-w-0 flex-1 truncate">
                        {s.title}{" "}
                        <span className="text-muted-foreground">
                          · {formatDateShort(s.starts_at)} {formatTimeRange(s.starts_at, s.ends_at)}
                        </span>
                      </span>
                      <Badge variant="warning" className="tabular-nums">
                        {s.shift_signups.length}/{s.capacity}
                      </Badge>
                    </div>
                  ))}
                  {needs.slice(0, MAX_GAP_ROWS).map((n) => {
                    const pledged = n.need_pledges.reduce((s, p) => s + p.quantity, 0);
                    return (
                      <div key={n.id} className="flex items-center gap-2">
                        <Cake className="size-3.5 shrink-0 text-muted-foreground" />
                        <span className="min-w-0 flex-1 truncate">{n.title}</span>
                        <Badge variant="warning" className="tabular-nums">
                          {pledged}/{n.quantity_needed} {n.unit ?? ""}
                        </Badge>
                      </div>
                    );
                  })}
                  {openShopping > 0 ? (
                    <Link href={`/admin/termine/${event.id}#einkauf`} className="flex items-center gap-2 hover:underline">
                      <ShoppingCart className="size-3.5 shrink-0 text-muted-foreground" />
                      <span className="min-w-0 flex-1 truncate">Einkaufsliste</span>
                      <Badge variant="warning" className="tabular-nums">
                        {openShopping} offen
                      </Badge>
                    </Link>
                  ) : null}
                  {shifts.length > MAX_GAP_ROWS || needs.length > MAX_GAP_ROWS ? (
                    <Link href={`/admin/termine/${event.id}`} className="mt-1 text-xs font-medium text-primary hover:underline">
                      +{Math.max(0, shifts.length - MAX_GAP_ROWS) + Math.max(0, needs.length - MAX_GAP_ROWS)} weitere offene
                      Punkte →
                    </Link>
                  ) : null}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <section>
          <SectionTitle>Letzte Eintragungen</SectionTitle>
          {activity.length === 0 ? (
            <EmptyState title="Noch keine Eintragungen" />
          ) : (
            <Card>
              <ul className="divide-y divide-border">
                {activity.map((a) => (
                  <li key={a.key}>
                    <Link href={`/admin/termine/${a.eventId}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted">
                      <Avatar name={a.who} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{a.who}</p>
                        <p className="truncate text-xs text-muted-foreground">{a.what}</p>
                      </div>
                      <span className="shrink-0 text-xs text-muted-foreground">{formatStamp(a.at)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </section>

        <section>
          <SectionTitle
            action={
              <Link href="/admin/statistik" className="text-sm font-medium text-primary hover:underline">
                Statistik
              </Link>
            }
          >
            Noch nirgends eingetragen ({inactive.length})
          </SectionTitle>
          {inactive.length === 0 ? (
            <EmptyState title="Alle haben schon mitgemacht!" />
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {inactive.map((s) => (
                <PersonChip key={s.id} name={s.full_name} />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
