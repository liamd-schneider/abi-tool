import { Check, Pencil, Plus, Trash } from "lucide-react";
import { ActionForm, Hidden, SubmitButton } from "@/components/action-form";
import { Badge } from "@/components/ui/badge";
import { Field, Input, Select } from "@/components/ui/input";
import { Avatar } from "@/components/ui/misc";
import { Progress } from "@/components/ui/progress";
import { adminRemovePledge, deleteNeed, saveNeed, setDelivered } from "@/actions/admin";
import { formatStamp } from "@/lib/dates";
import { NEED_KIND_LABEL, type NeedRow, type NeedWithPledges } from "@/lib/types";

function NeedFields({ need }: { need?: NeedRow }) {
  return (
    <>
      <Field label="Was wird benötigt? *" className="sm:col-span-2">
        <Input name="title" defaultValue={need?.title} required maxLength={120} placeholder="z. B. Kuchen, Waffelteig, Pavillon, Verlängerungskabel" />
      </Field>
      <Field label="Art">
        <Select name="kind" defaultValue={need?.kind ?? "spende"}>
          <option value="spende">Spende (z. B. Kuchen, Getränke)</option>
          <option value="leihgabe">Leihgabe (z. B. Pavillon, Waffeleisen)</option>
          <option value="material">Material (z. B. Deko, Becher)</option>
        </Select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Menge *">
          <Input name="quantity_needed" type="number" min={1} defaultValue={need?.quantity_needed ?? 1} required />
        </Field>
        <Field label="Einheit">
          <Input name="unit" defaultValue={need?.unit ?? ""} placeholder="Stück, Bleche, l" maxLength={30} />
        </Field>
      </div>
      <Field label="Beschreibung" className="sm:col-span-2">
        <Input name="description" defaultValue={need?.description ?? ""} placeholder="Optional – z. B. bitte ohne Nüsse, bis 13 Uhr abgeben" />
      </Field>
    </>
  );
}

export function NeedAdmin({ need }: { need: NeedWithPledges }) {
  const pledged = need.need_pledges.reduce((s, p) => s + p.quantity, 0);
  const unit = need.unit ?? "";

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold">{need.title}</p>
          {need.description ? <p className="text-sm text-muted-foreground">{need.description}</p> : null}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <Badge variant="outline">{NEED_KIND_LABEL[need.kind]}</Badge>
          <Badge variant={pledged >= need.quantity_needed ? "success" : "warning"} className="tabular-nums">
            {pledged}/{need.quantity_needed} {unit}
          </Badge>
        </div>
      </div>
      <Progress value={pledged} max={need.quantity_needed} />

      {need.need_pledges.length === 0 ? (
        <p className="text-sm text-muted-foreground">Noch niemand eingetragen.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {need.need_pledges.map((p) => (
            <li key={p.id} className="flex items-center gap-2 py-1.5">
              <Avatar name={p.profiles?.full_name ?? "?"} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {p.profiles?.full_name ?? "Unbekannt"} <span className="font-normal text-muted-foreground">· {p.quantity} {unit}</span>
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {formatStamp(p.created_at)}
                  {p.note ? ` · „${p.note}“` : ""}
                </p>
              </div>
              <ActionForm action={setDelivered}>
                <Hidden name="id" value={p.id} />
                <SubmitButton
                  name="delivered"
                  value={p.delivered ? "" : "true"}
                  variant={p.delivered ? "success" : "outline"}
                  size="xs"
                  title={p.delivered ? "Abgegeben" : "Als abgegeben markieren"}
                >
                  <Check className="size-3.5" /> <span className="hidden sm:inline">{p.delivered ? "da" : "abgegeben?"}</span>
                </SubmitButton>
              </ActionForm>
              <ActionForm action={adminRemovePledge} confirm="Eintrag entfernen?">
                <Hidden name="id" value={p.id} />
                <SubmitButton variant="destructive-ghost" size="xs" aria-label="Entfernen">
                  <Trash className="size-3.5" />
                </SubmitButton>
              </ActionForm>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
        <details className="flex-1">
          <summary className="inline-flex cursor-pointer items-center gap-1 text-sm font-medium text-primary">
            <Pencil className="size-3.5" /> Bearbeiten
          </summary>
          <ActionForm action={saveNeed} className="mt-3 grid gap-3 sm:grid-cols-2">
            <Hidden name="id" value={need.id} />
            <NeedFields need={need} />
            <div className="sm:col-span-2">
              <SubmitButton size="sm">Speichern</SubmitButton>
            </div>
          </ActionForm>
        </details>
        <ActionForm action={deleteNeed} confirm={`„${need.title}“ löschen?`}>
          <Hidden name="id" value={need.id} />
          <SubmitButton variant="destructive-ghost" size="sm">
            <Trash className="size-4" /> Löschen
          </SubmitButton>
        </ActionForm>
      </div>
    </div>
  );
}

export function AddNeedForm({ eventId }: { eventId: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border p-4">
      <p className="mb-3 font-semibold">Bedarf hinzufügen</p>
      <ActionForm action={saveNeed} resetOnSuccess className="grid gap-3 sm:grid-cols-2">
        <Hidden name="event_id" value={eventId} />
        <NeedFields />
        <div className="sm:col-span-2">
          <SubmitButton size="sm">
            <Plus className="size-4" /> Hinzufügen
          </SubmitButton>
        </div>
      </ActionForm>
    </div>
  );
}
