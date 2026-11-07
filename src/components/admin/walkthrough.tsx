"use client";

import { startTransition, useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  BellRing,
  BookOpen,
  CalendarPlus,
  ChartColumn,
  ChevronLeft,
  ChevronRight,
  Clock,
  LayoutDashboard,
  Link2,
  Megaphone,
  Rocket,
  ShoppingCart,
  Users,
  Vote,
  X,
  type LucideIcon,
} from "lucide-react";
import { PushToggle } from "@/components/push";
import { Button } from "@/components/ui/button";
import { completeAdminTour } from "@/actions/admin";
import { cn } from "@/lib/utils";

const OPEN_EVENT = "abi-tool:open-admin-tour";

interface Step {
  href?: string;
  icon: LucideIcon;
  title: string;
  intro: string;
  points: ReactNode[];
  push?: boolean;
}

const STEPS: Step[] = [
  {
    href: "/admin",
    icon: LayoutDashboard,
    title: "Willkommen im Admin-Bereich",
    intro: "In ein paar kurzen Schritten zeige ich dir, wie du das Abi-Tool einrichtest. Die Seite im Hintergrund wechselt automatisch mit.",
    points: [
      <>
        Die <b>Übersicht</b> zeigt dir auf einen Blick: freie Schichtplätze, fehlende Spenden, die letzten Eintragungen und wer
        noch nirgends dabei ist.
      </>,
      <>
        Die <b>Einrichtungs-Checkliste</b> oben zeigt, was noch zu tun ist.
      </>,
      <>
        Diese Anleitung kannst du jederzeit über <b>Anleitung</b> oben rechts wieder öffnen.
      </>,
    ],
  },
  {
    href: "/admin/jahrgang",
    icon: Link2,
    title: "1 · Jahrgang & Login-Link",
    intro: "Hier stehen Name eurer Schule und eures Jahrgangs – und der Zugang für alle.",
    points: [
      <>Prüf, ob Schulname, Ort und Abi-Jahr stimmen. So erscheint euer Jahrgang beim Login.</>,
      <>
        Der <b>Login-Link</b> ist euer Eingang: Wer ihn einmal öffnet, muss den Jahrgang nie wieder angeben. Er wird beim
        Anlegen von Accounts automatisch mit den Zugangsdaten verschickt.
      </>,
      <>
        Der <b>Jahrgangs-Code</b> ist der Ersatz, falls jemand ohne Link einloggt und es den Benutzernamen an einer anderen
        Schule auch gibt.
      </>,
    ],
  },
  {
    href: "/admin/mitglieder",
    icon: Users,
    title: "2 · Mitglieder anlegen",
    intro: "Alle bekommen einen eigenen Account mit Benutzername und Passwort.",
    points: [
      <>
        Namensliste einfügen – <b>eine Person pro Zeile</b> (z. B. aus Excel oder der WhatsApp-Gruppe kopieren).
      </>,
      <>Benutzernamen (vorname.nachname) und Startpasswörter werden automatisch erzeugt.</>,
      <>
        <b>Zugangsdaten sofort als CSV sichern</b> – die Passwörter werden nur einmal angezeigt. Dann persönlich verteilen (der
        Login-Link ist automatisch dabei).
      </>,
      <>
        Weitere Komitee-Leute: auf die Person tippen → <b>Zum Admin machen</b>. Passwort vergessen? → <b>Passwort zurücksetzen</b>.
      </>,
    ],
  },
  {
    href: "/admin/termine/neu",
    icon: CalendarPlus,
    title: "3 · Termin anlegen",
    intro: "Ob Kuchenverkauf, Party oder Abiball – alles beginnt mit einem Termin.",
    points: [
      <>
        Titel, Beginn/Ende, <b>Ort und Adresse</b> – der Google-Maps-Link entsteht automatisch.
      </>,
      <>
        <b>Hinweise für Helfende</b>: Treffpunkt, Kleidung, was man mitbringen soll.
      </>,
      <>
        Ohne Haken bei <b>Veröffentlichen</b> ist der Termin ein Entwurf, den nur Admins sehen. Erst veröffentlichen, wenn alles
        steht – dann werden alle benachrichtigt.
      </>,
    ],
  },
  {
    href: "/admin/termine",
    icon: Clock,
    title: "4 · Schichten, Spenden & Sortiment",
    intro: "Tippe in der Liste auf einen Termin – dort richtest du alles Weitere ein.",
    points: [
      <>
        <b>Schichten</b> einzeln anlegen oder mit <b>Schichtblöcke erzeugen</b> auf einmal (z. B. Verkauf 14–20 Uhr in
        2-Stunden-Blöcken, je 2 Leute).
      </>,
      <>
        <b>Bedarf</b>: Spenden (Kuchen, Waffelteig), Leihgaben (Pavillon, Waffeleisen) und Material – mit Menge. Alle sehen, was
        noch fehlt.
      </>,
      <>
        <b>Sortiment</b> mit Preisen – erscheint auf der Terminseite.
      </>,
      <>Du kannst Leute selbst ein- und austragen. Nach dem Event ✓ bzw. ✗ für die Anwesenheit setzen.</>,
    ],
  },
  {
    href: "/admin/termine",
    icon: ShoppingCart,
    title: "5 · Orga-Team & Einkaufsliste",
    intro: "Jeder Termin kann ein eigenes Orga-Team haben, das dir Arbeit abnimmt.",
    points: [
      <>
        Im Termin unter <b>Orga-Team</b> Leute hinzufügen und <b>jedes Mal auswählen, was sie dürfen</b>: Einkaufsliste,
        Schichten, Spenden & Material, Sortiment oder Termindaten.
      </>,
      <>Veröffentlichen, Löschen und das Orga-Team selbst bleiben immer bei den Admins.</>,
      <>
        Die <b>Einkaufsliste</b> sehen nur Admins und das Orga-Team: Artikel eintragen, festlegen wer kauft, abhaken wenn
        besorgt, Betrag eintragen – die Summe wird automatisch berechnet.
      </>,
      <>Das Orga-Team findet seine Termine auf der Startseite unter „Du bist im Orga-Team“.</>,
    ],
  },
  {
    href: "/admin/neuigkeiten",
    icon: Megaphone,
    title: "6 · Neuigkeiten",
    intro: "Infos an den ganzen Jahrgang – ohne dass sie im Gruppenchat untergehen.",
    points: [
      <>Alle bekommen eine Benachrichtigung, mit aktiviertem Push auch direkt aufs Handy.</>,
      <>
        Wichtiges <b>oben anheften</b> – dann bleibt es ganz oben auf der Startseite.
      </>,
    ],
  },
  {
    href: "/admin/abstimmungen",
    icon: Vote,
    title: "7 · Abstimmungen",
    intro: "Funktioniert wie eine WhatsApp-Umfrage.",
    points: [
      <>
        Frage + Antwortmöglichkeiten, <b>Einzel- oder Mehrfachwahl</b>.
      </>,
      <>
        <b>Anonym</b>: Niemand – auch kein Admin – sieht, wer was gewählt hat.
      </>,
      <>Optional mit Enddatum. Ergebnisse live, inkl. wie viele schon abgestimmt haben.</>,
    ],
  },
  {
    href: "/admin/statistik",
    icon: ChartColumn,
    title: "8 · Statistik",
    intro: "Wer hat wie viel gemacht?",
    points: [
      <>
        Schichten, Stunden und Spenden pro Person. Vergangene Schichten zählen automatisch – außer jemand ist mit ✗ als nicht
        erschienen markiert.
      </>,
      <>Export als CSV für Excel: Statistik oder alle Eintragungen mit Zeitpunkt.</>,
    ],
  },
  {
    icon: BellRing,
    title: "Fast fertig: Push aktivieren",
    intro: "Damit du sofort mitbekommst, wenn sich jemand kurzfristig (unter 48 h) von einer Schicht abmeldet.",
    push: true,
    points: [
      <>
        Am Handy die Seite zuerst <b>zum Home-Bildschirm hinzufügen</b> – auf dem iPhone geht Push nur so.
      </>,
      <>Schicht-Erinnerungen gehen automatisch jeden Nachmittag an alle, die am nächsten Tag eingetragen sind.</>,
      <>
        Sag dem Jahrgang: unter <b>Profil</b> Push aktivieren und das Startpasswort ändern.
      </>,
    ],
  },
];

export function AdminWalkthrough({ autoStart, vapidKey }: { autoStart: boolean; vapidKey: string | null }) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(autoStart);
  const [step, setStep] = useState(() => Math.max(0, STEPS.findIndex((s) => s.href === pathname)));

  function goTo(index: number) {
    setStep(index);
    const href = STEPS[index].href;
    if (href && href !== pathname) router.push(href);
  }

  function start() {
    setOpen(true);
    goTo(0);
  }

  function close() {
    setOpen(false);
    startTransition(async () => {
      await completeAdminTour();
    });
  }

  // Öffnen von außen (Button in der Checkliste)
  useEffect(() => {
    const handler = () => start();
    window.addEventListener(OPEN_EVENT, handler);
    return () => window.removeEventListener(OPEN_EVENT, handler);
  });

  const current = STEPS[step];
  const Icon = current.icon;
  const last = step === STEPS.length - 1;

  return (
    <>
      <Button variant="outline" size="sm" onClick={start}>
        <BookOpen className="size-4" /> Anleitung
      </Button>

      {open ? (
        <div
          role="dialog"
          aria-label="Anleitung für den Admin-Bereich"
          className="fixed inset-x-3 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-50 md:inset-x-auto md:right-6 md:bottom-6 md:w-[420px]"
        >
          <div className="flex max-h-[70dvh] flex-col overflow-hidden rounded-2xl border border-primary/30 bg-card shadow-2xl">
            <div className="flex items-center gap-3 border-b border-border bg-primary-soft px-4 py-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Icon className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-primary">
                  Schritt {step + 1} von {STEPS.length}
                </p>
                <p className="leading-tight font-semibold">{current.title}</p>
              </div>
              <button
                type="button"
                onClick={close}
                className="rounded-md p-1 text-muted-foreground hover:bg-card hover:text-foreground"
                aria-label="Anleitung schließen"
                title="Schließen"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-3 text-sm">
              <p className="text-muted-foreground">{current.intro}</p>
              <ul className="mt-3 flex flex-col gap-2">
                {current.points.map((point, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
              {current.push ? (
                <div className="mt-4 rounded-xl border border-border p-3">
                  <PushToggle vapidKey={vapidKey} />
                </div>
              ) : null}
            </div>

            <div className="flex items-center gap-2 border-t border-border px-4 py-3">
              <div className="flex flex-1 items-center gap-1">
                {STEPS.map((s, i) => (
                  <button
                    key={s.title}
                    type="button"
                    onClick={() => goTo(i)}
                    className={cn("h-1.5 rounded-full transition-all", i === step ? "w-5 bg-primary" : "w-1.5 bg-muted-foreground/30")}
                    aria-label={`Schritt ${i + 1}: ${s.title}`}
                  />
                ))}
              </div>
              {step > 0 ? (
                <Button variant="ghost" size="sm" onClick={() => goTo(step - 1)}>
                  <ChevronLeft className="size-4" /> Zurück
                </Button>
              ) : null}
              {last ? (
                <Button size="sm" onClick={close}>
                  <Rocket className="size-4" /> Los geht’s
                </Button>
              ) : (
                <Button size="sm" onClick={() => goTo(step + 1)}>
                  Weiter <ChevronRight className="size-4" />
                </Button>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

/** Startet die Anleitung von irgendwo im Admin-Bereich */
export function StartTourButton({ children }: { children: ReactNode }) {
  return (
    <Button variant="secondary" size="sm" onClick={() => window.dispatchEvent(new Event(OPEN_EVENT))}>
      <BookOpen className="size-4" /> {children}
    </Button>
  );
}
