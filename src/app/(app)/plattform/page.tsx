import type { Metadata } from "next";
import { Building2, MousePointerClick, Pencil, Trash, Users } from "lucide-react";
import { ActionForm, Hidden, SubmitButton } from "@/components/action-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox, Field, Input, Textarea } from "@/components/ui/input";
import { AddPanel, PageHeader, SectionTitle } from "@/components/ui/misc";
import { deletePartner, savePartner, setCohortActive } from "@/actions/platform";
import { requirePlatformAdmin } from "@/lib/auth";
import { formatStamp, nowMs } from "@/lib/dates";
import { fetchAll } from "@/lib/stats";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Partner } from "@/lib/types";

export const metadata: Metadata = { title: "Plattform" };

const CATEGORIES = ["Abi-Shirts & Pullis", "Abibuch & Druck", "Abiball & Location", "Abifahrt & Reisen", "Fotografie", "Party & DJ", "Finanzen"];

interface CohortRow {
  id: string;
  name: string;
  slug: string;
  active: boolean;
  created_at: string;
  schools: { name: string; city: string | null } | null;
}

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

export default async function PlatformPage() {
  const me = await requirePlatformAdmin();
  const admin = createAdminClient();
  const since = new Date(nowMs() - 30 * 86_400_000).toISOString();

  const [{ data: cohortData }, { count: schoolCount }, profiles, { data: partnerData }, clicks] = await Promise.all([
    admin.from("cohorts").select("id, name, slug, active, created_at, schools(name, city)").order("created_at", { ascending: false }),
    admin.from("schools").select("id", { count: "exact", head: true }),
    fetchAll<{ cohort_id: string }>((from, to) => admin.from("profiles").select("cohort_id").range(from, to)),
    admin.from("partners").select("*").order("sort_order").order("name"),
    fetchAll<{ partner_id: string; created_at: string }>((from, to) =>
      admin.from("partner_clicks").select("partner_id, created_at").gte("created_at", since).range(from, to),
    ),
  ]);

  const cohorts = (cohortData ?? []) as unknown as CohortRow[];
  const partners = (partnerData ?? []) as Partner[];
  const members = new Map<string, number>();
  for (const p of profiles) members.set(p.cohort_id, (members.get(p.cohort_id) ?? 0) + 1);
  const clickCount = new Map<string, number>();
  for (const c of clicks) clickCount.set(c.partner_id, (clickCount.get(c.partner_id) ?? 0) + 1);

  const tiles = [
    { label: "Schulen", value: schoolCount ?? 0, icon: Building2 },
    { label: "Jahrgänge", value: `${cohorts.filter((c) => c.active).length}/${cohorts.length}`, icon: Users },
    { label: "Mitglieder", value: profiles.length, icon: Users },
    { label: "Partner-Klicks (30 Tage)", value: clicks.length, icon: MousePointerClick },
  ];

  return (
    <div className="flex flex-col gap-8">
      <div>
        <p className="mb-2 text-xs font-semibold tracking-wider text-primary uppercase">Plattform-Betrieb</p>
        <PageHeader title="Plattform" description="Alle Schulen und Jahrgänge, Partner-Hub und Klickzahlen." className="mb-0" />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map(({ label, value, icon: Icon }) => (
          <Card key={label}>
            <CardContent className="flex items-center gap-3 pt-4 sm:pt-4">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
                <Icon className="size-5" />
              </span>
              <div className="min-w-0">
                <p className="text-2xl font-bold tabular-nums">{value}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <section>
        <SectionTitle>Jahrgänge ({cohorts.length})</SectionTitle>
        <Card>
          <ul className="divide-y divide-border">
            {cohorts.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium break-words">
                    {c.schools?.name ?? "?"}
                    {c.schools?.city ? `, ${c.schools.city}` : ""} · {c.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {members.get(c.id) ?? 0} Mitglieder · seit {formatStamp(c.created_at)} · /j/{c.slug}
                  </p>
                </div>
                {c.active ? <Badge variant="success">aktiv</Badge> : <Badge variant="destructive">gesperrt</Badge>}
                {c.id !== me.cohort_id ? (
                  <ActionForm
                    action={setCohortActive}
                    confirm={c.active ? `„${c.name}“ sperren? Niemand aus dem Jahrgang kommt dann noch rein.` : undefined}
                  >
                    <Hidden name="id" value={c.id} />
                    <Hidden name="active" value={!c.active} />
                    <SubmitButton size="sm" variant={c.active ? "destructive-ghost" : "outline"}>
                      {c.active ? "Sperren" : "Freischalten"}
                    </SubmitButton>
                  </ActionForm>
                ) : (
                  <span className="text-xs text-muted-foreground">dein Jahrgang</span>
                )}
              </li>
            ))}
          </ul>
        </Card>
      </section>

      <section>
        <SectionTitle>Partner-Hub ({partners.length})</SectionTitle>
        <datalist id="partner-categories">
          {CATEGORIES.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
        <div className="flex flex-col gap-3">
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
                        <MousePointerClick className="size-3" /> {clickCount.get(p.id) ?? 0} Klicks
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
            Klicks werden über /go/&lt;id&gt; gezählt; an den Partner-Link werden automatisch utm-Parameter angehängt (falls noch
            keine vorhanden sind).
          </p>
        </div>
      </section>
    </div>
  );
}
