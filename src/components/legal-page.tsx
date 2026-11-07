import type { ReactNode } from "react";

/** Gemeinsamer Rahmen für Impressum, Datenschutz & Nutzungsbedingungen */
export function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:py-14">
      <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
      <div className="mt-4 rounded-xl border border-warning/50 bg-warning/10 p-4 text-sm">
        <b>Entwurf – vor dem Start ausfüllen und rechtlich prüfen lassen.</b> Alles in [eckigen Klammern] sind Platzhalter.
      </div>
      <div className="mt-8 flex flex-col gap-6 text-sm leading-relaxed [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-foreground [&_li]:ml-5 [&_li]:list-disc [&_p]:text-muted-foreground">
        {children}
      </div>
    </div>
  );
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2>{title}</h2>
      {children}
    </section>
  );
}
