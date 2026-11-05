import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Eye, Trash } from "lucide-react";
import { ActionForm, Hidden, SubmitButton } from "@/components/action-form";
import { OrganizersAdmin } from "@/components/admin/organizers-admin";
import { EventSections } from "@/components/event-sections";
import { LocationLink } from "@/components/event-bits";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { SectionTitle } from "@/components/ui/misc";
import { deleteEvent, setEventPublished } from "@/actions/admin";
import { formatRange } from "@/lib/dates";
import { loadEventManagement } from "@/lib/event-data";
import { EVENT_PERMISSIONS } from "@/lib/event-permissions";

export const metadata: Metadata = { title: "Termin verwalten" };

export default async function AdminEventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await loadEventManagement(id);
  const { event, shifts, organizers, members } = data;
  if (!event) notFound();

  const slots = shifts.reduce((s, x) => s + x.capacity, 0);
  const filled = shifts.reduce((s, x) => s + Math.min(x.capacity, x.shift_signups.length), 0);
  const helpers = new Set(shifts.flatMap((s) => s.shift_signups.map((x) => x.user_id))).size;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <Link href="/admin/termine" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> Alle Termine
        </Link>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight break-words">{event.title}</h1>
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

      <section id="orga" className="scroll-mt-20">
        <SectionTitle>Orga-Team ({organizers.length})</SectionTitle>
        <OrganizersAdmin eventId={event.id} organizers={organizers} members={members} />
      </section>

      <EventSections {...data} event={event} permissions={[...EVENT_PERMISSIONS]} isAdmin />
    </div>
  );
}
