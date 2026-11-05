import { Pencil, Plus, Trash } from "lucide-react";
import { ActionForm, Hidden, SubmitButton } from "@/components/action-form";
import { Field, Input } from "@/components/ui/input";
import { AddPanel } from "@/components/ui/misc";
import { deleteProduct, saveProduct } from "@/actions/event";
import type { ProductRow } from "@/lib/types";
import { formatPrice } from "@/lib/utils";

function ProductFields({ product }: { product?: ProductRow }) {
  return (
    <>
      <Field label="Produkt *">
        <Input name="name" defaultValue={product?.name} required maxLength={120} placeholder="z. B. Waffel mit Puderzucker" />
      </Field>
      <Field label="Preis (€)">
        <Input name="price" inputMode="decimal" defaultValue={product?.price?.toString().replace(".", ",") ?? ""} placeholder="1,50" />
      </Field>
      <Field label="Beschreibung">
        <Input name="description" defaultValue={product?.description ?? ""} placeholder="Optional – z. B. vegan, mit Nüssen" />
      </Field>
      <Field label="Reihenfolge">
        <Input name="sort_order" type="number" defaultValue={product?.sort_order ?? 0} />
      </Field>
    </>
  );
}

export function ProductAdmin({ eventId, products }: { eventId: string; products: ProductRow[] }) {
  return (
    <div className="flex flex-col gap-4">
      {products.length > 0 ? (
        <ul className="divide-y divide-border rounded-xl border border-border bg-card">
          {products.map((p) => (
            <li key={p.id} className="px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{p.name}</p>
                  {p.description ? <p className="text-sm text-muted-foreground">{p.description}</p> : null}
                </div>
                <span className="font-semibold tabular-nums">{formatPrice(p.price)}</span>
                <ActionForm action={deleteProduct} confirm={`„${p.name}“ entfernen?`}>
                  <Hidden name="id" value={p.id} />
                  <SubmitButton variant="destructive-ghost" size="xs" aria-label="Entfernen">
                    <Trash className="size-3.5" />
                  </SubmitButton>
                </ActionForm>
              </div>
              <details className="mt-1">
                <summary className="inline-flex cursor-pointer items-center gap-1 text-xs font-medium text-primary">
                  <Pencil className="size-3" /> Bearbeiten
                </summary>
                <ActionForm action={saveProduct} className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-4">
                  <Hidden name="id" value={p.id} />
                  <ProductFields product={p} />
                  <div className="sm:col-span-4">
                    <SubmitButton size="sm">Speichern</SubmitButton>
                  </div>
                </ActionForm>
              </details>
            </li>
          ))}
        </ul>
      ) : null}

      <AddPanel title="Produkt zum Sortiment hinzufügen" defaultOpen={products.length === 0}>
        <ActionForm action={saveProduct} resetOnSuccess className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <Hidden name="event_id" value={eventId} />
          <ProductFields />
          <div className="sm:col-span-4">
            <SubmitButton size="sm">
              <Plus className="size-4" /> Hinzufügen
            </SubmitButton>
          </div>
        </ActionForm>
      </AddPanel>
    </div>
  );
}
