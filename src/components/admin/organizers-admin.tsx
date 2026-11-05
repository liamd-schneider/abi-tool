import { ChevronDown, UserPlus, X } from "lucide-react";
import { ActionForm, Hidden, SubmitButton } from "@/components/action-form";
import { Badge } from "@/components/ui/badge";
import { Checkbox, Select } from "@/components/ui/input";
import { AddPanel, Avatar } from "@/components/ui/misc";
import { removeOrganizer, setOrganizer } from "@/actions/admin";
import { EVENT_PERMISSIONS, PERMISSION_INFO, isEventPermission } from "@/lib/event-permissions";
import type { MemberRef, OrganizerRow } from "@/lib/types";

function PermissionCheckboxes({ selected }: { selected: string[] }) {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {EVENT_PERMISSIONS.map((p) => (
        <Checkbox
          key={p}
          name="permission"
          value={p}
          defaultChecked={selected.includes(p)}
          className="rounded-lg border border-border p-2.5"
          label={
            <span>
              <span className="font-medium">{PERMISSION_INFO[p].label}</span>
              <span className="block text-xs text-muted-foreground">{PERMISSION_INFO[p].hint}</span>
            </span>
          }
        />
      ))}
    </div>
  );
}

/** Admins legen pro Termin fest, wer im Orga-Team ist und was die Person darf */
export function OrganizersAdmin({
  eventId,
  organizers,
  members,
}: {
  eventId: string;
  organizers: OrganizerRow[];
  members: MemberRef[];
}) {
  const taken = new Set(organizers.map((o) => o.user_id));
  const candidates = members.filter((m) => m.role !== "admin" && !taken.has(m.id));

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        Das Orga-Team kann diesen Termin mitverwalten – genau mit den Rechten, die du auswählst. Die Einkaufsliste sieht das ganze
        Orga-Team. Veröffentlichen, Löschen und das Orga-Team selbst bleiben bei den Admins.
      </p>

      {organizers.length > 0 ? (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
          {organizers.map((o) => {
            const name = o.profiles?.full_name ?? "Unbekannt";
            const perms = o.permissions.filter(isEventPermission);
            return (
              <li key={o.user_id}>
                <details className="group">
                  <summary className="flex cursor-pointer items-center gap-3 p-3 select-none">
                    <Avatar name={name} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{name}</p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {perms.length > 0 ? (
                          perms.map((p) => (
                            <Badge key={p} variant="muted">
                              {PERMISSION_INFO[p].label}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-xs text-muted-foreground">nur ansehen</span>
                        )}
                      </div>
                    </div>
                    <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
                  </summary>
                  <div className="flex flex-col gap-3 border-t border-border p-3">
                    <ActionForm action={setOrganizer} className="flex flex-col gap-3">
                      <Hidden name="event_id" value={eventId} />
                      <Hidden name="user_id" value={o.user_id} />
                      <Hidden name="is_update" value="1" />
                      <PermissionCheckboxes selected={perms} />
                      <div>
                        <SubmitButton size="sm">Rechte speichern</SubmitButton>
                      </div>
                    </ActionForm>
                    <ActionForm action={removeOrganizer} confirm={`${name} aus dem Orga-Team entfernen?`}>
                      <Hidden name="event_id" value={eventId} />
                      <Hidden name="user_id" value={o.user_id} />
                      <SubmitButton variant="destructive-ghost" size="sm">
                        <X className="size-4" /> Aus dem Orga-Team entfernen
                      </SubmitButton>
                    </ActionForm>
                  </div>
                </details>
              </li>
            );
          })}
        </ul>
      ) : null}

      {candidates.length > 0 ? (
        <AddPanel title="Person zum Orga-Team hinzufügen">
          <ActionForm action={setOrganizer} resetOnSuccess className="flex flex-col gap-3">
            <Hidden name="event_id" value={eventId} />
            <Select name="user_id" defaultValue="" required aria-label="Person">
              <option value="" disabled>
                Person auswählen …
              </option>
              {candidates.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.full_name}
                </option>
              ))}
            </Select>
            <div>
              <p className="mb-2 text-sm font-medium">Was darf die Person bei diesem Termin?</p>
              <PermissionCheckboxes selected={["einkauf"]} />
            </div>
            <div>
              <SubmitButton size="sm">
                <UserPlus className="size-4" /> Hinzufügen
              </SubmitButton>
            </div>
          </ActionForm>
        </AddPanel>
      ) : (
        <p className="text-sm text-muted-foreground">Alle Mitglieder sind schon im Orga-Team (Admins dürfen sowieso alles).</p>
      )}
    </div>
  );
}
