import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { EventSections } from "@/components/event-sections";
import { Badge } from "@/components/ui/badge";
import { Notice } from "@/components/ui/misc";
import { formatRange } from "@/lib/dates";
import { loadEventManagement } from "@/lib/event-data";
import { EVENT_PERMISSIONS, PERMISSION_INFO } from "@/lib/event-permissions";
import { getEventAccess } from "@/lib/permissions";
import { requireUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Termin organisieren" };

/** Verwaltungsseite für das Orga-Team (Admins landen auf der vollen Admin-Seite) */
export default async function OrganizeEventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireUser();
  const access = await getEventAccess(id);
  if (access.isAdmin) redirect(`/admin/termine/${id}`);
  if (!access.isOrganizer) redirect(`/termine/${id}`);

  const data = await loadEventManagement(id);
  if (!data.event) notFound();
  const { event } = data;
  const missing = EVENT_PERMISSIONS.filter((p) => !access.permissions.includes(p));

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <Link href={`/termine/${event.id}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> Zur Terminseite
        </Link>
        <div>
          <p className="text-xs font-semibold tracking-wider text-primary uppercase">Orga-Team</p>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight break-words">{event.title}</h1>
            {!event.published ? <Badge variant="warning">Entwurf</Badge> : null}
          </div>
          <p className="text-sm text-muted-foreground">{formatRange(event.starts_at, event.ends_at)}</p>
        </div>
        <Notice tone="info" icon={<ShieldCheck className="size-5 text-primary" />}>
          <p className="font-semibold">Deine Rechte bei diesem Termin</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {access.permissions.length > 0 ? (
              access.permissions.map((p) => <Badge key={p}>{PERMISSION_INFO[p].label}</Badge>)
            ) : (
              <span className="text-muted-foreground">Nur ansehen</span>
            )}
          </div>
          {missing.length > 0 ? (
            <p className="mt-2 text-xs text-muted-foreground">
              {missing.map((p) => PERMISSION_INFO[p].label).join(", ")}, Veröffentlichen und Löschen übernimmt das Abikomitee.
            </p>
          ) : null}
        </Notice>
      </div>

      <EventSections {...data} event={event} permissions={access.permissions} isAdmin={false} />
    </div>
  );
}
