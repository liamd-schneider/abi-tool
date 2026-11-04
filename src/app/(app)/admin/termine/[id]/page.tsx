import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Eye, Pencil, Trash } from "lucide-react";
import { ActionForm, Hidden, SubmitButton } from "@/components/action-form";
import { EventForm } from "@/components/admin/event-form";
import { AddNeedForm, NeedAdmin } from "@/components/admin/need-admin";
import { ProductAdmin } from "@/components/admin/product-admin";
import { AddShiftForms, ShiftAdmin } from "@/components/admin/shift-admin";
import { LocationLink } from "@/components/event-bits";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SectionTitle } from "@/components/ui/misc";
import { deleteEvent, setEventPublished } from "@/actions/admin";
import { formatRange } from "@/lib/dates";
import { EVENT_FIELDS, NEED_SELECT, SHIFT_SELECT } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";
import type { EventRow, NeedWithPledges, ProductRow, ShiftWithSignups } from "@/lib/types";

export const metadata: Metadata = { title: "Termin bearbeiten" };

export default async function AdminEventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const [eventRes, shiftsRes, needsRes, productsRes, membersRes] = await Promise.all([
    supabase.from("events").select(EVENT_FIELDS).eq("id", id).maybeSingle(),
    supabase.from("shifts").select(SHIFT_SELECT).eq("event_id", id).order("starts_at").order("title"),
    supabase.from("event_needs").select(NEED_SELECT).eq("event_id", id).order("created_at"),
    supabase.from("event_products").select("*").eq("event_id", id).order("sort_order").order("name"),
    supabase.from("profiles").select("id, full_name").order("full_name"),
  ]);

  const event = eventRes.data as EventRow | null;
  if (!event) notFound();
  const shifts = (shiftsRes.data ?? []) as unknown as ShiftWithSignups[];
  const needs = (needsRes.data ?? []) as unknown as NeedWithPledges[];
  const products = (productsRes.data ?? []) as ProductRow[];
  const members = (membersRes.data ?? []) as { id: string; full_name: string }[];

  const slots = shifts.reduce((s, x) => s + x.capacity, 0);
  const filled = shifts.reduce((s, x) => s + Math.min(x.capacity, x.shift_signups.length), 0);
  const helpers = new Set(shifts.flatMap((s) => s.shift_signups.map((x) => x.user_id))).size;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <Link href="/admin/termine" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> Alle Termine
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">{event.title}</h1>
              {event.published ? <Badge variant="success">veröffentlicht</Badge> : <Badge variant="warning">Entwurf</Badge>}
            </div>
            <p className="text-sm text-muted-foreground">{formatRange(event.starts_at, event.ends_at)}</p>
            <LocationLink locationName={event.location_name} address={event.address} customMapsUrl={event.maps_url} className="text-sm" />
            <p className="mt-1 text-sm">
              Schichten: <b>{filled}/{slots}</b> Plätze belegt · <b>{helpers}</b> verschiedene Helfende
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={`/termine/${event.id}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
              <Eye className="size-4" /> Ansicht für alle
            </Link>
            <ActionForm action={setEventPublished}>
              <Hidden name="id" value={event.id} />
              <Hidden name="published" value={!event.published} />
              <SubmitButton size="sm" variant={event.published ? "outline" : "success"}>
                {event.published ? "Zurück zu Entwurf" : "Veröffentlichen"}
              </SubmitButton>
            </ActionForm>
            <ActionForm
              action={deleteEvent}
              confirm={`„${event.title}“ mit allen Schichten, Einträgen und Anmerkungen endgültig löschen?`}
            >
              <Hidden name="id" value={event.id} />
              <SubmitButton size="sm" variant="destructive-ghost">
                <Trash className="size-4" /> Löschen
              </SubmitButton>
            </ActionForm>
          </div>
        </div>
      </div>

      <details className="group rounded-xl border border-border bg-card">
        <summary className="flex cursor-pointer items-center gap-2 p-4 font-semibold">
          <Pencil className="size-4 text-primary" /> Termindaten bearbeiten (Zeit, Ort, Beschreibung, Hinweise)
        </summary>
        <div className="border-t border-border p-4">
          <EventForm event={event} />
        </div>
      </details>

      <section>
        <SectionTitle>Schichten ({shifts.length})</SectionTitle>
        {shifts.length > 0 ? (
          <div className="mb-4 grid gap-3 lg:grid-cols-2">
            {shifts.map((s) => (
              <ShiftAdmin key={s.id} shift={s} members={members} />
            ))}
          </div>
        ) : null}
        <AddShiftForms eventId={event.id} eventStart={event.starts_at} eventEnd={event.ends_at} />
      </section>

      <section>
        <SectionTitle>Spenden, Leihgaben & Material ({needs.length})</SectionTitle>
        {needs.length > 0 ? (
          <div className="mb-4 grid gap-3 lg:grid-cols-2">
            {needs.map((n) => (
              <NeedAdmin key={n.id} need={n} />
            ))}
          </div>
        ) : null}
        <AddNeedForm eventId={event.id} />
      </section>

      <section>
        <SectionTitle>Sortiment ({products.length})</SectionTitle>
        <ProductAdmin eventId={event.id} products={products} />
      </section>

      <Card>
        <CardContent className="pt-4 text-sm text-muted-foreground sm:pt-5">
          Anmerkungen zum Termin findest du in der{" "}
          <Link href={`/termine/${event.id}`} className="font-medium text-primary hover:underline">
            Ansicht für alle
          </Link>{" "}
          – dort kannst du als Admin auch Kommentare löschen.
        </CardContent>
      </Card>
    </div>
  );
}
