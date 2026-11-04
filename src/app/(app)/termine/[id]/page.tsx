import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Info, Pencil } from "lucide-react";
import { CalendarButtons } from "@/components/calendar-buttons";
import { Comments } from "@/components/comments";
import { DateBlock, LocationLink } from "@/components/event-bits";
import { NeedCard } from "@/components/need-card";
import { ShiftCard } from "@/components/shift-card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState, Multiline, Notice, SectionTitle } from "@/components/ui/misc";
import { requireUser } from "@/lib/auth";
import { formatRange, isUpcoming, nowMs, relativeDay } from "@/lib/dates";
import { EVENT_FIELDS, NEED_SELECT, SHIFT_SELECT } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";
import type { CommentRow, EventRow, NeedWithPledges, ProductRow, ShiftWithSignups } from "@/lib/types";
import { formatPrice } from "@/lib/utils";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("events").select("title").eq("id", id).maybeSingle();
  return { title: data?.title ?? "Termin" };
}

export default async function EventPage({ params }: Props) {
  const { id } = await params;
  const me = await requireUser();
  const supabase = await createClient();

  const [eventRes, shiftsRes, needsRes, productsRes, commentsRes] = await Promise.all([
    supabase.from("events").select(EVENT_FIELDS).eq("id", id).maybeSingle(),
    supabase.from("shifts").select(SHIFT_SELECT).eq("event_id", id).order("starts_at").order("title"),
    supabase.from("event_needs").select(NEED_SELECT).eq("event_id", id).order("created_at"),
    supabase.from("event_products").select("*").eq("event_id", id).order("sort_order").order("name"),
    supabase
      .from("event_comments")
      .select("id, event_id, user_id, body, created_at, profiles(full_name, username)")
      .eq("event_id", id)
      .order("created_at"),
  ]);

  const event = eventRes.data as EventRow | null;
  if (!event) notFound();

  const shifts = (shiftsRes.data ?? []) as unknown as ShiftWithSignups[];
  const needs = (needsRes.data ?? []) as unknown as NeedWithPledges[];
  const products = (productsRes.data ?? []) as ProductRow[];
  const comments = (commentsRes.data ?? []) as unknown as CommentRow[];
  const now = nowMs();
  const upcoming = isUpcoming(event.starts_at, event.ends_at, now);
  const location = [event.location_name, event.address].filter(Boolean).join(", ") || null;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-2">
          <Link href="/termine" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-4" /> Alle Termine
          </Link>
          {me.role === "admin" ? (
            <Link href={`/admin/termine/${event.id}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
              <Pencil className="size-4" /> Bearbeiten
            </Link>
          ) : null}
        </div>

        <div className="flex gap-4">
          <DateBlock iso={event.starts_at} className="hidden w-16 py-2 sm:flex" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{event.title}</h1>
              {!event.published ? <Badge variant="warning">Entwurf</Badge> : null}
              {upcoming ? <Badge variant="muted">{relativeDay(event.starts_at, now)}</Badge> : <Badge variant="muted">vorbei</Badge>}
            </div>
            <p className="mt-1 font-medium">{formatRange(event.starts_at, event.ends_at)}</p>
            <LocationLink
              locationName={event.location_name}
              address={event.address}
              customMapsUrl={event.maps_url}
              className="mt-1 text-sm"
            />
          </div>
        </div>

        {upcoming ? (
          <CalendarButtons
            icsHref={`/api/ics/event/${event.id}`}
            item={{
              uid: `event-${event.id}@abi-tool`,
              title: event.title,
              start: event.starts_at,
              end: event.ends_at,
              location,
              description: event.description,
            }}
          />
        ) : null}

        {event.description ? (
          <Card>
            <CardContent className="pt-4 sm:pt-5">
              <Multiline text={event.description} />
            </CardContent>
          </Card>
        ) : null}

        {event.notes ? (
          <Notice tone="info" icon={<Info className="size-5 text-primary" />}>
            <p className="font-semibold">Hinweise vom Komitee</p>
            <Multiline text={event.notes} />
          </Notice>
        ) : null}
      </div>

      <section id="schichten" className="scroll-mt-20">
        <SectionTitle>Schichten</SectionTitle>
        {shifts.length === 0 ? (
          <EmptyState title="Für diesen Termin gibt es (noch) keine Schichten." />
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {shifts.map((s) => (
              <ShiftCard key={s.id} shift={s} meId={me.id} event={{ id: event.id, title: event.title, location }} />
            ))}
          </div>
        )}
      </section>

      {needs.length > 0 ? (
        <section id="dienste" className="scroll-mt-20">
          <SectionTitle>Spenden, Leihgaben & Material</SectionTitle>
          <div className="grid gap-3 md:grid-cols-2">
            {needs.map((n) => (
              <NeedCard key={n.id} need={n} meId={me.id} event={{ id: event.id, title: event.title }} closed={!upcoming} />
            ))}
          </div>
        </section>
      ) : null}

      {products.length > 0 ? (
        <section>
          <SectionTitle>Sortiment</SectionTitle>
          <Card>
            <ul className="divide-y divide-border">
              {products.map((p) => (
                <li key={p.id} className="flex items-baseline justify-between gap-4 px-4 py-3">
                  <div className="min-w-0">
                    <p className="font-medium">{p.name}</p>
                    {p.description ? <p className="text-sm text-muted-foreground">{p.description}</p> : null}
                  </div>
                  <span className="shrink-0 font-semibold tabular-nums">{formatPrice(p.price)}</span>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      ) : null}

      <section>
        <SectionTitle>Anmerkungen</SectionTitle>
        <Comments eventId={event.id} comments={comments} me={me} />
      </section>
    </div>
  );
}
