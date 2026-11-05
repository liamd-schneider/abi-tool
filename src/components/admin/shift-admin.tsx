import { Check, Pencil, Plus, Trash, X } from "lucide-react";
import { ActionForm, Hidden, SubmitButton } from "@/components/action-form";
import { Badge } from "@/components/ui/badge";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { AddPanel, Avatar } from "@/components/ui/misc";
import { Progress } from "@/components/ui/progress";
import { addSignupFor, deleteShift, generateShifts, removeSignupFor, saveShift, setAttendance } from "@/actions/event";
import { addHours, formatDateShort, formatStamp, formatTimeRange, toLocalInput } from "@/lib/dates";
import type { ShiftRow, ShiftWithSignups } from "@/lib/types";

type Member = { id: string; full_name: string };

function ShiftFields({ shift, defaultStart, defaultEnd }: { shift?: ShiftRow; defaultStart: string; defaultEnd: string }) {
  return (
    <>
      <Field label="Bezeichnung *" className="sm:col-span-2">
        <Input name="title" defaultValue={shift?.title} required maxLength={120} placeholder="z. B. Aufbau, Kasse, Grill, Abbau" />
      </Field>
      <Field label="Beginn *">
        <Input name="starts_at" type="datetime-local" defaultValue={toLocalInput(shift?.starts_at ?? defaultStart)} required />
      </Field>
      <Field label="Ende *">
        <Input name="ends_at" type="datetime-local" defaultValue={toLocalInput(shift?.ends_at ?? defaultEnd)} required />
      </Field>
      <Field label="Benötigte Helfende *">
        <Input name="capacity" type="number" min={1} max={500} defaultValue={shift?.capacity ?? 2} required />
      </Field>
      <Field label="Beschreibung">
        <Input name="description" defaultValue={shift?.description ?? ""} placeholder="Optional – Aufgaben, Treffpunkt …" />
      </Field>
    </>
  );
}

export function ShiftAdmin({ shift, members }: { shift: ShiftWithSignups; members: Member[] }) {
  const signups = [...shift.shift_signups].sort((a, b) => a.created_at.localeCompare(b.created_at));
  const taken = signups.length;
  const free = shift.capacity - taken;
  const signedUp = new Set(signups.map((s) => s.user_id));
  const available = members.filter((m) => !signedUp.has(m.id));

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold">{shift.title}</p>
          <p className="text-sm text-muted-foreground">
            {formatDateShort(shift.starts_at)} · {formatTimeRange(shift.starts_at, shift.ends_at)} Uhr
          </p>
          {shift.description ? <p className="text-sm">{shift.description}</p> : null}
        </div>
        <Badge variant={free <= 0 ? "success" : "warning"} className="tabular-nums">
          {taken}/{shift.capacity}
        </Badge>
      </div>
      <Progress value={taken} max={shift.capacity} />

      {signups.length === 0 ? (
        <p className="text-sm text-muted-foreground">Noch niemand eingetragen.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {signups.map((s) => (
            <li key={s.user_id} className="flex items-center gap-2 py-1.5">
              <Avatar name={s.profiles?.full_name ?? "?"} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{s.profiles?.full_name ?? "Unbekannt"}</p>
                <p className="text-xs text-muted-foreground">eingetragen {formatStamp(s.created_at)}</p>
              </div>
              <ActionForm action={setAttendance} className="flex gap-1">
                <Hidden name="shift_id" value={shift.id} />
                <Hidden name="user_id" value={s.user_id} />
                <SubmitButton
                  name="attended"
                  value={s.attended === true ? "" : "true"}
                  variant={s.attended === true ? "success" : "outline"}
                  size="xs"
                  title="Erschienen"
                  aria-label="Erschienen"
                >
                  <Check className="size-3.5" />
                </SubmitButton>
                <SubmitButton
                  name="attended"
                  value={s.attended === false ? "" : "false"}
                  variant={s.attended === false ? "destructive" : "outline"}
                  size="xs"
                  title="Nicht erschienen"
                  aria-label="Nicht erschienen"
                >
                  <X className="size-3.5" />
                </SubmitButton>
              </ActionForm>
              <ActionForm action={removeSignupFor} confirm={`${s.profiles?.full_name ?? "Person"} austragen?`}>
                <Hidden name="shift_id" value={shift.id} />
                <Hidden name="user_id" value={s.user_id} />
                <SubmitButton variant="destructive-ghost" size="xs" title="Austragen" aria-label="Austragen">
                  <Trash className="size-3.5" />
                </SubmitButton>
              </ActionForm>
            </li>
          ))}
        </ul>
      )}

      {free > 0 && available.length > 0 ? (
        <ActionForm action={addSignupFor} className="flex gap-2">
          <Hidden name="shift_id" value={shift.id} />
          <Select name="user_id" defaultValue="" className="h-8 flex-1 text-sm" aria-label="Person eintragen">
            <option value="" disabled>
              Person eintragen …
            </option>
            {available.map((m) => (
              <option key={m.id} value={m.id}>
                {m.full_name}
              </option>
            ))}
          </Select>
          <SubmitButton variant="outline" size="sm">
            <Plus className="size-4" />
          </SubmitButton>
        </ActionForm>
      ) : null}

      <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
        <details className="group flex-1">
          <summary className="inline-flex cursor-pointer items-center gap-1 text-sm font-medium text-primary">
            <Pencil className="size-3.5" /> Bearbeiten
          </summary>
          <ActionForm action={saveShift} className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Hidden name="id" value={shift.id} />
            <ShiftFields shift={shift} defaultStart={shift.starts_at} defaultEnd={shift.ends_at} />
            <div className="sm:col-span-2">
              <SubmitButton size="sm">Speichern</SubmitButton>
            </div>
          </ActionForm>
        </details>
        <ActionForm
          action={deleteShift}
          confirm={`Schicht „${shift.title}“ löschen?${taken ? ` ${taken} eingetragene Person(en) werden benachrichtigt.` : ""}`}
        >
          <Hidden name="id" value={shift.id} />
          <SubmitButton variant="destructive-ghost" size="sm">
            <Trash className="size-4" /> Löschen
          </SubmitButton>
        </ActionForm>
      </div>
    </div>
  );
}

export function AddShiftForms({
  eventId,
  eventStart,
  eventEnd,
  open = false,
}: {
  eventId: string;
  eventStart: string;
  eventEnd: string | null;
  open?: boolean;
}) {
  const end = eventEnd ?? addHours(eventStart, 2);
  return (
    <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-2">
      <AddPanel title="Schicht hinzufügen" defaultOpen={open}>
        <ActionForm action={saveShift} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Hidden name="event_id" value={eventId} />
          <ShiftFields defaultStart={eventStart} defaultEnd={addHours(eventStart, 2)} />
          <div className="sm:col-span-2">
            <SubmitButton size="sm">
              <Plus className="size-4" /> Schicht anlegen
            </SubmitButton>
          </div>
        </ActionForm>
      </AddPanel>

      <AddPanel
        title="Mehrere Schichtblöcke auf einmal"
        hint="z. B. „Verkauf“ von 14 bis 20 Uhr in 2-Stunden-Blöcken → 3 Schichten auf einmal."
      >
        <ActionForm action={generateShifts} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Hidden name="event_id" value={eventId} />
          <Field label="Bezeichnung *" className="sm:col-span-2">
            <Input name="title" required maxLength={120} placeholder="z. B. Verkauf" />
          </Field>
          <Field label="Von *">
            <Input name="from" type="datetime-local" defaultValue={toLocalInput(eventStart)} required />
          </Field>
          <Field label="Bis *">
            <Input name="to" type="datetime-local" defaultValue={toLocalInput(end)} required />
          </Field>
          <Field label="Blocklänge (Minuten)">
            <Input name="block_minutes" type="number" min={15} step={15} defaultValue={120} required />
          </Field>
          <Field label="Helfende pro Block">
            <Input name="capacity" type="number" min={1} max={500} defaultValue={2} required />
          </Field>
          <Field label="Beschreibung" className="sm:col-span-2">
            <Textarea name="description" rows={2} />
          </Field>
          <div className="sm:col-span-2">
            <SubmitButton size="sm" variant="secondary">
              Blöcke erzeugen
            </SubmitButton>
          </div>
        </ActionForm>
      </AddPanel>
    </div>
  );
}
