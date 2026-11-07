import type { Metadata } from "next";
import { Gift } from "lucide-react";
import { PartnerCard } from "@/components/partner-card";
import { EmptyState, PageHeader, SectionTitle } from "@/components/ui/misc";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Partner } from "@/lib/types";

export const metadata: Metadata = { title: "Partner" };

export default async function PartnerHubPage() {
  await requireUser();
  const supabase = await createClient();
  const { data } = await supabase.from("partners").select("*").eq("active", true).order("sort_order").order("name");
  const partners = (data ?? []) as Partner[];

  const groups = new Map<string, Partner[]>();
  for (const p of partners) groups.set(p.category, [...(groups.get(p.category) ?? []), p]);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Partner & Angebote"
        description="Nützliches für euer Abi – von Abi-Shirts bis Abifahrt. Mit diesen Angeboten bleibt das Abi-Tool für euch kostenlos."
        className="mb-0"
      />
      {groups.size === 0 ? (
        <EmptyState icon={<Gift className="size-6" />} title="Bald gibt es hier Angebote für euren Jahrgang" />
      ) : (
        [...groups.entries()].map(([category, list]) => (
          <section key={category}>
            <SectionTitle>{category}</SectionTitle>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {list.map((p) => (
                <PartnerCard key={p.id} partner={p} source="app" />
              ))}
            </div>
          </section>
        ))
      )}
      <p className="text-xs text-muted-foreground">
        Alle Angebote sind Anzeigen. Für Klicks bzw. Buchungen über diese Links erhält die Plattform ggf. eine Vergütung – für
        euch ändert sich am Preis nichts.
      </p>
    </div>
  );
}
