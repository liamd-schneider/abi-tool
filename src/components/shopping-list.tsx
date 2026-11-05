import { Check, Pencil, Plus, ShoppingCart, Trash } from "lucide-react";
import { ActionForm, Hidden, SubmitButton } from "@/components/action-form";
import { Field, Input, Select } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { deleteShoppingItem, saveShoppingItem, setShoppingBought } from "@/actions/event";
import { formatStamp } from "@/lib/dates";
import type { ShoppingItem } from "@/lib/types";
import { cn, formatPrice } from "@/lib/utils";

type Person = { id: string; full_name: string };

function AssigneeSelect({ people, defaultValue }: { people: Person[]; defaultValue?: string | null }) {
  return (
    <Select name="assigned_to" defaultValue={defaultValue ?? ""} aria-label="Wer kauft?">
      <option value="">Wer kauft? (offen)</option>
      {people.map((p) => (
        <option key={p.id} value={p.id}>
          {p.full_name}
        </option>
      ))}
    </Select>
  );
}

/** Einkaufsliste eines Termins – nur für Admins und Orga-Team sichtbar */
export function ShoppingList({
  eventId,
  items,
  canEdit,
  people,
  names,
}: {
  eventId: string;
  items: ShoppingItem[];
  canEdit: boolean;
  /** Mögliche Einkäufer:innen (Orga-Team + Admins) */
  people: Person[];
  /** user_id → Name (für "besorgt von") */
  names: Record<string, string>;
}) {
  const open = items.filter((i) => !i.bought_at);
  const done = items.filter((i) => i.bought_at).sort((a, b) => (b.bought_at ?? "").localeCompare(a.bought_at ?? ""));
  const spent = items.reduce((sum, i) => sum + (i.cost ?? 0), 0);

  return (
    <div className="flex flex-col gap-3">
      {items.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 text-sm">
            <span>
              <b className="tabular-nums">
                {done.length}/{items.length}
              </b>{" "}
              besorgt
            </span>
            {spent > 0 ? (
              <span className="text-muted-foreground">
                Ausgegeben: <b className="text-foreground tabular-nums">{formatPrice(spent)}</b>
              </span>
            ) : null}
          </div>
          <Progress value={done.length} max={items.length} />
        </div>
      ) : null}

      {canEdit ? (
        <ActionForm action={saveShoppingItem} resetOnSuccess className="grid grid-cols-1 gap-2 rounded-xl border border-dashed border-border p-3 sm:grid-cols-[1fr_8rem]">
          <Hidden name="event_id" value={eventId} />
          <Input name="title" required maxLength={200} placeholder="Was wird gebraucht? z. B. Puderzucker" aria-label="Artikel" />
          <Input name="quantity" maxLength={60} placeholder="Menge" aria-label="Menge" />
          <Input name="note" maxLength={500} placeholder="Notiz (optional, z. B. Marke, Laden)" aria-label="Notiz" />
          <AssigneeSelect people={people} />
          <div className="sm:col-span-2">
            <SubmitButton size="sm" className="w-full sm:w-auto">
              <Plus className="size-4" /> Auf die Liste
            </SubmitButton>
          </div>
        </ActionForm>
      ) : null}

      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-1 rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
          <ShoppingCart className="size-6" />
          Die Einkaufsliste ist noch leer.
        </div>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
          {[...open, ...done].map((item) => {
            const bought = Boolean(item.bought_at);
            const assignee = item.assigned_to ? names[item.assigned_to] : null;
            const buyer = item.bought_by ? names[item.bought_by] : null;
            return (
              <li key={item.id} className="flex items-start gap-3 px-3 py-3">
                {canEdit ? (
                  <ActionForm action={setShoppingBought}>
                    <Hidden name="id" value={item.id} />
                    <Hidden name="bought" value={!bought} />
                    <SubmitButton
                      variant={bought ? "success" : "outline"}
                      size="icon"
                      className="size-8 rounded-full"
                      aria-label={bought ? "Wieder als offen markieren" : "Als besorgt abhaken"}
                      title={bought ? "Wieder offen" : "Besorgt"}
                    >
                      {bought ? <Check className="size-4" strokeWidth={3} /> : null}
                    </SubmitButton>
                  </ActionForm>
                ) : (
                  <span
                    className={cn(
                      "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full border-2",
                      bought ? "border-success bg-success text-white" : "border-input",
                    )}
                  >
                    {bought ? <Check className="size-4" strokeWidth={3} /> : null}
                  </span>
                )}

                <div className="min-w-0 flex-1">
                  <p className={cn("font-medium break-words", bought && "text-muted-foreground line-through")}>
                    {item.title}
                    {item.quantity ? <span className="font-normal text-muted-foreground"> · {item.quantity}</span> : null}
                  </p>
                  {item.note ? <p className="text-sm break-words text-muted-foreground">{item.note}</p> : null}
                  <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                    {assignee && !bought ? <span className="font-medium text-primary">kauft: {assignee}</span> : null}
                    {bought ? (
                      <span>
                        besorgt{buyer ? ` von ${buyer}` : ""} · {formatStamp(item.bought_at!)}
                      </span>
                    ) : null}
                    {item.cost !== null ? <span className="font-medium text-foreground">{formatPrice(item.cost)}</span> : null}
                  </div>

                  {canEdit ? (
                    <details className="mt-1">
                      <summary className="inline-flex cursor-pointer items-center gap-1 py-1 text-xs font-medium text-primary">
                        <Pencil className="size-3" /> Bearbeiten
                      </summary>
                      <div className="mt-2 flex flex-col gap-2">
                        <ActionForm action={saveShoppingItem} className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                          <Hidden name="id" value={item.id} />
                          <Field label="Artikel" className="sm:col-span-2">
                            <Input name="title" defaultValue={item.title} required maxLength={200} />
                          </Field>
                          <Field label="Menge">
                            <Input name="quantity" defaultValue={item.quantity ?? ""} maxLength={60} />
                          </Field>
                          <Field label="Betrag (€)" hint="Was hat es gekostet?">
                            <Input
                              name="cost"
                              inputMode="decimal"
                              defaultValue={item.cost?.toString().replace(".", ",") ?? ""}
                              placeholder="0,00"
                            />
                          </Field>
                          <Field label="Notiz" className="sm:col-span-2">
                            <Input name="note" defaultValue={item.note ?? ""} maxLength={500} />
                          </Field>
                          <Field label="Wer kauft?" className="sm:col-span-2">
                            <AssigneeSelect people={people} defaultValue={item.assigned_to} />
                          </Field>
                          <div className="sm:col-span-2">
                            <SubmitButton size="sm">Speichern</SubmitButton>
                          </div>
                        </ActionForm>
                        <ActionForm action={deleteShoppingItem} confirm={`„${item.title}“ von der Liste löschen?`}>
                          <Hidden name="id" value={item.id} />
                          <SubmitButton variant="destructive-ghost" size="sm">
                            <Trash className="size-4" /> Löschen
                          </SubmitButton>
                        </ActionForm>
                      </div>
                    </details>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
