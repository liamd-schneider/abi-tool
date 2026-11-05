import { Pencil } from "lucide-react";
import { EventForm } from "@/components/admin/event-form";
import { AddNeedForm, NeedAdmin } from "@/components/admin/need-admin";
import { ProductAdmin } from "@/components/admin/product-admin";
import { AddShiftForms, ShiftAdmin } from "@/components/admin/shift-admin";
import { ShoppingList } from "@/components/shopping-list";
import { SectionTitle } from "@/components/ui/misc";
import type { EventPermission } from "@/lib/event-permissions";
import type { EventRow, MemberRef, NeedWithPledges, OrganizerRow, ProductRow, ShiftWithSignups, ShoppingItem } from "@/lib/types";

/**
 * Verwaltungs-Bereiche eines Termins – gemeinsam genutzt von Admin-Seite und Orga-Seite.
 * Es wird nur angezeigt, wofür die Person das Recht hat.
 */
export function EventSections({
  event,
  permissions,
  isAdmin,
  shifts,
  needs,
  products,
  shopping,
  organizers,
  members,
}: {
  event: EventRow;
  permissions: EventPermission[];
  isAdmin: boolean;
  shifts: ShiftWithSignups[];
  needs: NeedWithPledges[];
  products: ProductRow[];
  shopping: ShoppingItem[];
  organizers: OrganizerRow[];
  members: MemberRef[];
}) {
  const can = (p: EventPermission) => permissions.includes(p);
  const names = Object.fromEntries(members.map((m) => [m.id, m.full_name]));
  const orgaIds = new Set(organizers.map((o) => o.user_id));
  const buyers = members.filter((m) => m.role === "admin" || orgaIds.has(m.id));
  const memberOptions = members.map((m) => ({ id: m.id, full_name: m.full_name }));

  return (
    <>
      <section id="einkauf" className="scroll-mt-20">
        <SectionTitle>
          Einkaufsliste{" "}
          <span className="text-sm font-normal text-muted-foreground">· nur für Orga-Team & Admins sichtbar</span>
        </SectionTitle>
        <ShoppingList eventId={event.id} items={shopping} canEdit={can("einkauf")} people={buyers} names={names} />
      </section>

      {can("schichten") ? (
        <section id="schichten" className="scroll-mt-20">
          <SectionTitle>Schichten ({shifts.length})</SectionTitle>
          {shifts.length > 0 ? (
            <div className="mb-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
              {shifts.map((s) => (
                <ShiftAdmin key={s.id} shift={s} members={memberOptions} />
              ))}
            </div>
          ) : null}
          <AddShiftForms eventId={event.id} eventStart={event.starts_at} eventEnd={event.ends_at} open={shifts.length === 0} />
        </section>
      ) : null}

      {can("bedarf") ? (
        <section id="dienste" className="scroll-mt-20">
          <SectionTitle>Spenden, Leihgaben & Material ({needs.length})</SectionTitle>
          {needs.length > 0 ? (
            <div className="mb-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
              {needs.map((n) => (
                <NeedAdmin key={n.id} need={n} />
              ))}
            </div>
          ) : null}
          <AddNeedForm eventId={event.id} open={needs.length === 0} />
        </section>
      ) : null}

      {can("sortiment") ? (
        <section id="sortiment" className="scroll-mt-20">
          <SectionTitle>Sortiment ({products.length})</SectionTitle>
          <ProductAdmin eventId={event.id} products={products} />
        </section>
      ) : null}

      {can("details") ? (
        <details className="rounded-xl border border-border bg-card" id="termindaten">
          <summary className="flex cursor-pointer items-center gap-2 p-4 font-semibold">
            <Pencil className="size-4 shrink-0 text-primary" /> Termindaten bearbeiten
            <span className="hidden font-normal text-muted-foreground sm:inline">(Zeit, Ort, Beschreibung, Hinweise)</span>
          </summary>
          <div className="border-t border-border p-4">
            <EventForm event={event} canPublish={isAdmin} />
          </div>
        </details>
      ) : null}
    </>
  );
}
