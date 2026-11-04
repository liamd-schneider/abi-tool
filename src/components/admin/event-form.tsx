import { ActionForm, Hidden, SubmitButton } from "@/components/action-form";
import { Checkbox, Field, Input, Textarea } from "@/components/ui/input";
import { saveEvent } from "@/actions/admin";
import { toLocalInput } from "@/lib/dates";
import type { EventRow } from "@/lib/types";

export function EventForm({ event }: { event?: EventRow }) {
  return (
    <ActionForm action={saveEvent} className="grid gap-4 sm:grid-cols-2">
      <Hidden name="id" value={event?.id} />
      <Field label="Titel *" htmlFor="title" className="sm:col-span-2">
        <Input id="title" name="title" defaultValue={event?.title} required maxLength={200} placeholder="z. B. Waffelverkauf in der großen Pause" />
      </Field>
      <Field label="Beginn *" htmlFor="starts_at">
        <Input id="starts_at" name="starts_at" type="datetime-local" defaultValue={toLocalInput(event?.starts_at)} required />
      </Field>
      <Field label="Ende" htmlFor="ends_at">
        <Input id="ends_at" name="ends_at" type="datetime-local" defaultValue={toLocalInput(event?.ends_at)} />
      </Field>
      <Field label="Ort / Location" htmlFor="location_name">
        <Input id="location_name" name="location_name" defaultValue={event?.location_name ?? ""} placeholder="z. B. Aula, Schulhof, Stadthalle" />
      </Field>
      <Field label="Adresse" htmlFor="address">
        <Input id="address" name="address" defaultValue={event?.address ?? ""} placeholder="Straße Nr., PLZ Ort" />
      </Field>
      <Field
        label="Google-Maps-Link"
        htmlFor="maps_url"
        hint="Optional. Leer lassen, dann wird der Link automatisch aus Ort und Adresse erzeugt."
        className="sm:col-span-2"
      >
        <Input id="maps_url" name="maps_url" type="url" defaultValue={event?.maps_url ?? ""} placeholder="https://maps.app.goo.gl/…" />
      </Field>
      <Field label="Kurzbeschreibung" htmlFor="description" className="sm:col-span-2">
        <Textarea id="description" name="description" rows={4} defaultValue={event?.description ?? ""} placeholder="Worum geht’s?" />
      </Field>
      <Field
        label="Hinweise für Helfende"
        htmlFor="notes"
        hint="Wird hervorgehoben angezeigt – z. B. Treffpunkt, Kleidung, was man mitbringen soll."
        className="sm:col-span-2"
      >
        <Textarea id="notes" name="notes" rows={3} defaultValue={event?.notes ?? ""} />
      </Field>
      <Checkbox
        name="published"
        defaultChecked={event?.published ?? false}
        label="Veröffentlichen (für alle sichtbar – alle bekommen eine Benachrichtigung)"
        className="sm:col-span-2"
      />
      <div className="sm:col-span-2">
        <SubmitButton>{event ? "Änderungen speichern" : "Termin anlegen"}</SubmitButton>
      </div>
    </ActionForm>
  );
}
