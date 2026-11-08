import type { Metadata } from "next";
import { MousePointerClick, Pencil, Trash } from "lucide-react";
import { ActionForm, Hidden, SubmitButton } from "@/components/action-form";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Checkbox, Field, Input, Textarea } from "@/components/ui/input";
import { AddPanel, PageHeader } from "@/components/ui/misc";
import { deletePartner, savePartner } from "@/actions/platform";
import { requirePlatformAdmin } from "@/lib/auth";
import { nowMs } from "@/lib/dates";
import { fetchAll } from "@/lib/stats";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Partner } from "@/lib/types";

export const metadata: Metadata = { title: "Partner-Hub" };

const CATEGORIES = ["Abi-Shirts & Pullis", "Abibuch & Druck", "Abiball & Location", "Abifahrt & Reisen", "Fotografie", "Party & DJ", "Finanzen"];

function PartnerFields({ partner }: { partner?: Partner }) {
  return (
    <>
      <Field label="Name *">
        <Input name="name" defaultValue={partner?.name} required maxLength={120} />
      </Field>
      <Field label="Kategorie *">
        <Input name="category" defaultValue={partner?.category} required maxLength={60} list="partner-categories" />
      </Field>
      <Field label="Link (mit Partner-/Affiliate-Kennung) *" className="sm:col-span-2">
        <Input name="url" type="url" defaultValue={partner?.url} required placeholder="https://…" />
      </Field>
      <Field label="Hervorhebung" hint="z. B. „10 % für Abi-Jahrgänge“">
        <Input name="highlight" defaultValue={partner?.highlight ?? ""} maxLength={80} />
      </Field>
      <Field label="Rabattcode">
        <Input name="discount_code" defaultValue={partner?.discount_code ?? ""} maxLength={60} />
      </Field>
      <Field label="Beschreibung" className="sm:col-span-2">
        <Textarea name="description" defaultValue={partner?.description ?? ""} maxLength={600} rows={2} />
      </Field>
      <Field label="Logo-URL (https)">
        <Input name="logo_url" type="url" defaultValue={partner?.logo_url ?? ""} />
      </Field>
      <Field label="Reihenfolge">
        <Input name="sort_order" type="number" defaultValue={partner?.sort_order ?? 0} />
      </Field>
      <Checkbox name="active" defaultChecked={partner?.active ?? true} label="Aktiv (für alle sichtbar)" className="sm:col-span-2" />
    </>
  );
}

export default async function PlatformPartnersPage() {
  await requirePlatformAdmin();
  const admin = createAdminClient();
  const since = new Date(nowMs() - 30 * 86_400_000).toISOString();
  const [{ data: partnerData }, clicks] = await Promise.all([
    admin.from("partners").select("*").order("sort_order").order("name"),
    fetchAll<{ partner_id: string }>((from, to) => admin.from("partner_clicks").select("partner_id").gte("created_at", since).range(from, to)),
  ]);
  const partners = (partnerData ?? []) as Partner[];
  const clickCount = new Map<string, number>();
  for (const c of clicks) clickCount.set(c.partner_id, (clickCount.get(c.partner_id) ?? 0) + 1);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Partner-Hub"
        description={`Nützliche Links für alle Jahrgänge – ${clicks.length} Klicks in den letzten 30 Tagen.`}
        className="mb-0"
      />
      <datalist id="partner-categories">
        {CATEGORIES.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>
      {partners.length > 0 ? (
        <Card>
          <ul className="divide-y divide-border">
            {partners.map((p) => (
              <li key={p.id} className="px-4 py-3">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium break-words">
                      {p.name} <span className="font-normal text-muted-foreground">· {p.category}</span>
                    </p>
                    <p className="truncate text-xs text-muted-foreground">{p.url}</p>
                  </div>
                  <Badge variant="muted" className="tabular-nums">
                    <MousePointerClick className="size-3" /> {clickCount.get(p.id) ?? 0} Klicks / 30 Tage
                  </Badge>
                  {p.active ? <Badge variant="success">aktiv</Badge> : <Badge variant="muted">aus</Badge>}
                </div>
                <details className="mt-1">
                  <summary className="inline-flex cursor-pointer items-center gap-1 py-1 text-xs font-medium text-primary">
                    <Pencil className="size-3" /> Bearbeiten
                  </summary>
                  <div className="mt-2 flex flex-col gap-2">
                    <ActionForm action={savePartner} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <Hidden name="id" value={p.id} />
                      <PartnerFields partner={p} />
                      <div className="sm:col-span-2">
                        <SubmitButton size="sm">Speichern</SubmitButton>
                      </div>
                    </ActionForm>
                    <ActionForm action={deletePartner} confirm={`„${p.name}“ mit allen Klickzahlen löschen?`}>
                      <Hidden name="id" value={p.id} />
                      <SubmitButton variant="destructive-ghost" size="sm">
                        <Trash className="size-4" /> Löschen
                      </SubmitButton>
                    </ActionForm>
                  </div>
                </details>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
      <AddPanel title="Partner hinzufügen" defaultOpen={partners.length === 0}>
        <ActionForm action={savePartner} resetOnSuccess className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <PartnerFields />
          <div className="sm:col-span-2">
            <SubmitButton size="sm">Anlegen</SubmitButton>
          </div>
        </ActionForm>
      </AddPanel>
      <p className="text-xs text-muted-foreground">
        Klicks werden über /go/&lt;id&gt; gezählt; an den Partner-Link werden automatisch utm-Parameter angehängt (falls noch keine
        vorhanden sind).
      </p>
    </div>
  );
}
