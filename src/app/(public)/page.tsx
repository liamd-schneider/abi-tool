import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  BellRing,
  Cake,
  CalendarSync,
  ChartColumn,
  Check,
  Clock,
  ClipboardList,
  Lock,
  ShoppingCart,
  Smartphone,
  Vote,
} from "lucide-react";
import { PartnerCard } from "@/components/partner-card";
import { buttonVariants } from "@/components/ui/button";
import { getCurrentProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Partner } from "@/lib/types";

export const metadata: Metadata = {
  title: { absolute: "Abi-Tool – Euer Abi. Endlich organisiert." },
  description:
    "Schichtpläne, Kuchenlisten, Abstimmungen und Termine für euren Abi-Jahrgang – an einem Ort statt in zwanzig WhatsApp-Gruppen. Kostenlos.",
  robots: { index: true, follow: true },
};

const FEATURES = [
  { icon: Clock, title: "Schichtpläne", text: "Kuchenverkauf, Party, Abiball: Schichten anlegen, alle tragen sich mit einem Klick ein – ohne Überbuchung." },
  { icon: Cake, title: "Spenden & Kuchenlisten", text: "Wer bringt was mit? Kuchen, Waffelteig, Pavillon – mit Mengen und Überblick, was noch fehlt." },
  { icon: Vote, title: "Abstimmungen", text: "Motto, Location, Pulli-Farbe: Abstimmen wie bei WhatsApp, auf Wunsch anonym, mit Live-Ergebnis." },
  { icon: BellRing, title: "Erinnerungen & Push", text: "Countdown bis zur eigenen Schicht und eine Erinnerung am Vortag – direkt aufs Handy." },
  { icon: ClipboardList, title: "Orga-Teams", text: "Pro Event ein Orga-Team mit genau den Rechten, die das Komitee freigibt." },
  { icon: ShoppingCart, title: "Einkaufslisten", text: "Was muss besorgt werden, wer kauft es, was hat es gekostet? Alles an einer Stelle." },
  { icon: CalendarSync, title: "Kalender-Abo", text: "Alle Termine und eigenen Schichten automatisch im Handy-Kalender." },
  { icon: ChartColumn, title: "Überblick fürs Komitee", text: "Wer hat sich wo eingetragen, wo fehlt noch was, wer hat wie viel geholfen." },
];

const STEPS = [
  { title: "Jahrgang registrieren", text: "Schule und Abi-Jahr eintragen – du bist automatisch Admin. Dauert zwei Minuten." },
  { title: "Namensliste einfügen", text: "Accounts für den ganzen Jahrgang auf einmal. Keine E-Mail-Adressen nötig." },
  { title: "Loslegen", text: "Termine, Schichten und Abstimmungen anlegen – alle bekommen Bescheid." },
];

const FAQ = [
  {
    q: "Was kostet das?",
    a: "Nichts. Die Plattform finanziert sich über ausgewählte Partnerangebote für Abi-Jahrgänge (z. B. Abi-Shirts, Abibuch, Abifahrt). Diese sind immer klar als Anzeige gekennzeichnet.",
  },
  {
    q: "Braucht jede:r eine E-Mail-Adresse?",
    a: "Nein. Das Komitee legt Accounts mit Benutzername und Passwort an – fertig. Wer will, ändert danach sein Passwort.",
  },
  {
    q: "Wer sieht unsere Daten?",
    a: "Nur euer Jahrgang. Jeder Jahrgang ist komplett abgeschottet, das wird direkt in der Datenbank erzwungen. Die Server stehen in Frankfurt (EU).",
  },
  {
    q: "Gibt es eine App?",
    a: "Das Abi-Tool läuft im Browser und lässt sich wie eine App auf den Home-Bildschirm legen – inklusive Push-Benachrichtigungen, auf Android und iPhone.",
  },
  {
    q: "Was passiert nach dem Abi?",
    a: "Ihr könnt euren Jahrgang jederzeit löschen lassen – dann werden alle Daten entfernt.",
  },
];

/** Mini-Vorschau der App im Handy-Rahmen (reines HTML/CSS) */
function PhonePreview() {
  return (
    <div className="relative mx-auto w-[260px] rounded-[2.2rem] border-[10px] border-foreground/90 bg-background shadow-2xl sm:w-[280px]">
      <div className="absolute top-0 left-1/2 h-5 w-24 -translate-x-1/2 rounded-b-2xl bg-foreground/90" />
      <div className="flex flex-col gap-3 p-3 pt-7 text-left">
        <p className="text-sm font-bold">Hallo Lena!</p>
        <div className="rounded-xl bg-linear-to-br from-primary to-primary/80 p-3 text-primary-foreground">
          <p className="text-[10px] font-medium opacity-90">Deine nächste Schicht</p>
          <p className="text-sm font-bold">Waffelstand</p>
          <p className="mt-1 text-xl font-bold tabular-nums">1 Tag 03:12:45</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-2.5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold">Kasse · Sommerfest</p>
            <span className="rounded-full bg-warning/20 px-1.5 text-[10px] font-medium text-warning-foreground">1/2</span>
          </div>
          <div className="mt-1.5 h-1 rounded-full bg-muted">
            <div className="h-1 w-1/2 rounded-full bg-primary" />
          </div>
          <div className="mt-2 inline-flex rounded-md bg-primary px-2 py-1 text-[10px] font-medium text-primary-foreground">+ Eintragen</div>
        </div>
        <div className="rounded-xl border border-border bg-card p-2.5">
          <p className="text-xs font-semibold">Welches Motto nehmen wir?</p>
          {[
            ["ABIos Amigos", 62],
            ["Abi-tur ins Glück", 38],
          ].map(([label, pct]) => (
            <div key={label} className="relative mt-1.5 overflow-hidden rounded-md border border-border px-2 py-1 text-[10px]">
              <div className="absolute inset-y-0 left-0 bg-primary/15" style={{ width: `${pct}%` }} />
              <div className="relative flex justify-between">
                <span>{label}</span>
                <span className="text-muted-foreground">{pct}%</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default async function LandingPage() {
  if (await getCurrentProfile()) redirect("/start");

  const { data } = await createAdminClient()
    .from("partners")
    .select("*")
    .eq("active", true)
    .order("sort_order")
    .order("name")
    .limit(6);
  const partners = (data ?? []) as Partner[];

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-linear-to-b from-primary-soft/70 to-background" aria-hidden />
        <div className="mx-auto grid w-full max-w-6xl grid-cols-1 items-center gap-12 px-4 pt-12 pb-16 md:grid-cols-2 md:pt-20 md:pb-24">
          <div className="flex flex-col items-start gap-5">
            <span className="rounded-full border border-primary/30 bg-card px-3 py-1 text-xs font-semibold text-primary">
              Kostenlos für Abi-Jahrgänge
            </span>
            <h1 className="text-4xl leading-[1.05] font-extrabold tracking-tight text-balance sm:text-5xl lg:text-6xl">
              Euer Abi. <span className="text-primary">Endlich organisiert.</span>
            </h1>
            <p className="max-w-xl text-lg text-muted-foreground text-pretty">
              Schichtpläne, Kuchenlisten, Abstimmungen und Termine – an einem Ort statt in zwanzig WhatsApp-Gruppen. Für das
              Abikomitee und den ganzen Jahrgang.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/registrieren" className={buttonVariants({ size: "lg" })}>
                Jahrgang kostenlos registrieren <ArrowRight className="size-4" />
              </Link>
              <Link href="/login" className={buttonVariants({ variant: "outline", size: "lg" })}>
                Anmelden
              </Link>
            </div>
            <ul className="flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-muted-foreground">
              <li className="flex items-center gap-1.5">
                <Check className="size-4 text-success" /> Keine E-Mail nötig
              </li>
              <li className="flex items-center gap-1.5">
                <Lock className="size-4 text-success" /> Server in Frankfurt
              </li>
              <li className="flex items-center gap-1.5">
                <Smartphone className="size-4 text-success" /> Als App aufs Handy
              </li>
            </ul>
          </div>
          <PhonePreview />
        </div>
      </section>

      {/* Funktionen */}
      <section id="funktionen" className="scroll-mt-16 border-t border-border">
        <div className="mx-auto w-full max-w-6xl px-4 py-16 md:py-20">
          <div className="max-w-2xl">
            <h2 className="text-3xl font-bold tracking-tight">Alles, was euer Jahrgang braucht</h2>
            <p className="mt-2 text-muted-foreground">Gebaut von einem Abikomitee – für Abikomitees.</p>
          </div>
          <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map(({ icon: Icon, title, text }) => (
              <div key={title} className="rounded-2xl border border-border bg-card p-5">
                <span className="flex size-10 items-center justify-center rounded-xl bg-primary-soft text-primary">
                  <Icon className="size-5" />
                </span>
                <h3 className="mt-4 font-semibold">{title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* So geht's */}
      <section id="so-gehts" className="scroll-mt-16 border-t border-border bg-muted/40">
        <div className="mx-auto w-full max-w-6xl px-4 py-16 md:py-20">
          <h2 className="text-3xl font-bold tracking-tight">In drei Schritten startklar</h2>
          <ol className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <li key={s.title} className="rounded-2xl border border-border bg-card p-5">
                <span className="flex size-9 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                  {i + 1}
                </span>
                <h3 className="mt-4 font-semibold">{s.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{s.text}</p>
              </li>
            ))}
          </ol>
          <Link href="/registrieren" className={buttonVariants({ size: "lg", className: "mt-8" })}>
            Jetzt starten <ArrowRight className="size-4" />
          </Link>
        </div>
      </section>

      {/* Partner */}
      <section id="partner" className="scroll-mt-16 border-t border-border">
        <div className="mx-auto w-full max-w-6xl px-4 py-16 md:py-20">
          <div className="max-w-2xl">
            <h2 className="text-3xl font-bold tracking-tight">Angebote für euren Jahrgang</h2>
            <p className="mt-2 text-muted-foreground">
              Abi-Shirts, Abibuch, Abifahrt, Location – mit unseren Partnern spart ihr Zeit und Geld. Und das Abi-Tool bleibt für
              euch kostenlos.
            </p>
          </div>
          {partners.length > 0 ? (
            <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {partners.map((p) => (
                <PartnerCard key={p.id} partner={p} source="landing" />
              ))}
            </div>
          ) : (
            <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {["Abi-Shirts & Pullis", "Abibuch & Druck", "Abiball-Locations", "Abifahrt & Reisen", "Fotografie", "Party & DJ"].map(
                (c) => (
                  <div key={c} className="rounded-xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
                    {c}
                  </div>
                ),
              )}
            </div>
          )}
          <p className="mt-6 text-sm text-muted-foreground">
            Ihr bietet etwas für Abi-Jahrgänge an und wollt Partner werden? Kontakt findet ihr im{" "}
            <Link href="/impressum" className="font-medium text-primary hover:underline">
              Impressum
            </Link>
            .
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="scroll-mt-16 border-t border-border bg-muted/40">
        <div className="mx-auto w-full max-w-3xl px-4 py-16 md:py-20">
          <h2 className="text-3xl font-bold tracking-tight">Häufige Fragen</h2>
          <div className="mt-8 flex flex-col gap-3">
            {FAQ.map((f) => (
              <details key={f.q} className="group rounded-xl border border-border bg-card p-4">
                <summary className="flex cursor-pointer items-center justify-between gap-3 font-semibold select-none">
                  {f.q}
                  <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" />
                </summary>
                <p className="mt-2 text-sm text-muted-foreground">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Abschluss */}
      <section className="border-t border-border">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-5 px-4 py-16 text-center md:py-20">
          <h2 className="text-3xl font-bold tracking-tight text-balance">Bereit für das entspannteste Abi-Jahr?</h2>
          <p className="max-w-xl text-muted-foreground">Registriert euren Jahrgang in zwei Minuten – kostenlos.</p>
          <Link href="/registrieren" className={buttonVariants({ size: "lg" })}>
            Jahrgang registrieren <ArrowRight className="size-4" />
          </Link>
        </div>
      </section>
    </>
  );
}
