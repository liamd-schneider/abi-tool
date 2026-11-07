# Abi-Tool

Planungstool für unseren Abi-Jahrgang: Termine, Schichtpläne, Spenden/Dienste, Neuigkeiten, Benachrichtigungen und Abstimmungen – mit Admin-Bereich fürs Abikomitee.

**Stack:** Next.js 16 (App Router) · Supabase (Postgres, Auth, RLS) · Tailwind CSS 4 · Vercel

## Funktionen

**Für alle**
- **Start:** nächste eigene Schicht mit Live-Countdown, Warnung 72 h (gelb) bzw. 24 h (rot) vorher, nächste Termine, wo noch Leute fehlen, offene Abstimmungen, Neuigkeiten
- **Termine:** Beschreibung, Zeit, Ort mit Google-Maps-Link, Hinweise vom Komitee, Sortiment, Anmerkungen (Kommentare)
- **Schichten:** mit einem Klick ein-/austragen, alle sehen, wer wo eingetragen ist, Überbuchung ist unmöglich
- **Dienste & Spenden:** Kuchen, Waffelteig, Leihgaben (Pavillon …), Material – mit Mengen
- **Abstimmungen** wie bei WhatsApp: antippen = abstimmen, Einzel-/Mehrfachwahl, optional anonym, Live-Ergebnisse
- **Benachrichtigungen:** neue Termine, Neuigkeiten und Abstimmungen, geänderte/gestrichene Schichten, Erinnerung am Vortag – in der App (Glocke) und als **Push aufs Handy** (Web Push, ohne Firebase/Google Console; iPhone ab iOS 16.4 nach „Zum Home-Bildschirm“)
- **Kalender ohne Google-API:** „Zu Google Kalender“-Button, `.ics`-Download und persönlicher Abo-Link (webcal) für alle Termine + eigene Schichten
- Login mit **Benutzername + Passwort** (`vorname.nachname`), man bleibt dauerhaft eingeloggt; als App auf den Homescreen legbar

**Orga-Team pro Termin**
- Admins setzen pro Termin Leute ins **Orga-Team** und wählen jedes Mal einzeln, was sie dürfen: Einkaufsliste, Schichten, Spenden & Material, Sortiment, Termindaten
- Veröffentlichen, Löschen und das Orga-Team selbst bleiben immer bei den Admins (auch per Datenbank-Trigger abgesichert)
- Das Orga-Team verwaltet „seine“ Termine unter `/termine/<id>/verwalten` (Link auf der Startseite und der Terminseite) und sieht sie auch als Entwurf
- **Einkaufsliste** pro Termin (nur Admins + Orga-Team sichtbar): Artikel, Menge, Notiz, wer kauft, abhaken wenn besorgt, Betrag → Summe „Ausgegeben“

**Für Admins (`/admin`)**
- **Walkthrough**: startet beim ersten Besuch automatisch (jederzeit über „Anleitung“), dazu eine Einrichtungs-Checkliste in der Übersicht
- Termine anlegen/bearbeiten/veröffentlichen (Entwurf → veröffentlicht)
- Schichten einzeln oder als Blöcke erzeugen (z. B. 14–20 Uhr in 2-h-Blöcken), Personen ein-/austragen, Anwesenheit abhaken
- Bedarf (Spenden/Leihgaben/Material) und Sortiment pflegen, „abgegeben“ abhaken
- Übersicht: was noch fehlt, letzte Eintragungen (wer, wann, was), wer noch nirgends dabei ist
- Mitglieder per Namensliste anlegen (Zugangsdaten als Liste/CSV), Passwort zurücksetzen, Admin-Rechte vergeben
- Statistik pro Person (Schichten, Stunden, Spenden, Anwesenheit) + CSV-Export

## Lokal starten

```bash
npm install
cp .env.example .env.local   # Werte eintragen (siehe unten)
npm run dev                  # http://localhost:3000
```

### Umgebungsvariablen

| Variable | Wofür |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase-Projekt-URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable Key (`sb_publishable_…`) |
| `SUPABASE_SECRET_KEY` | Secret Key (`sb_secret_…`) – **geheim**, nur serverseitig (Accounts anlegen, Kalender-Feed, Cron) |
| `AUTH_USERNAME_EMAIL_DOMAIN` | interne Pseudo-Mail-Domain für Logins, Standard `abi.local` |
| `CRON_SECRET` | schützt `/api/cron/reminders` |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | Schlüsselpaar für Web Push – erzeugen mit `npx web-push generate-vapid-keys`. Privater Schlüssel ist **geheim**. |
| `VAPID_SUBJECT` | Kontakt für die Push-Dienste (`https://…` oder `mailto:…`) |
| `DATABASE_URL` | nur für Migrationen (`npm run db:push`), nicht auf Vercel nötig |

## Datenbank

Das Schema liegt in [`supabase/migrations/`](supabase/migrations). Neue Migration anlegen und einspielen:

```bash
npx supabase migration new <name>   # SQL-Datei bearbeiten
npm run db:push                     # spielt neue Migrationen ein
```

Alle Zugriffsrechte sind per Row Level Security in der Datenbank geregelt: Mitglieder können nur ihre eigenen Einträge ändern, das Orga-Team eines Termins genau das, wofür es freigeschaltet ist (`can_manage(event_id, recht)`), Admins alles, ohne Login gibt es keine Daten.

**Wichtig in Supabase:** Authentication → Sign In / Providers → „Allow new users to sign up“ muss **aus** sein. Accounts legen nur Admins an.

## Accounts

```bash
npm run create-admin -- "Vorname Nachname"   # ersten Admin anlegen (gibt Passwort aus)
```

Alle weiteren Accounts im Browser unter **Admin → Mitglieder**: Namensliste einfügen → Benutzernamen und Startpasswörter werden erzeugt.

## Deployment (Vercel)

1. Repo in Vercel importieren (Framework: Next.js, keine weiteren Einstellungen nötig).
2. Unter *Settings → Environment Variables* setzen: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `AUTH_USERNAME_EMAIL_DOMAIN`, `CRON_SECRET`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`.
3. Deployen. Der Cron-Job aus [`vercel.json`](vercel.json) läuft täglich um 15:00 UTC (16/17 Uhr deutscher Zeit) und erinnert an Schichten der nächsten 36 Stunden.

## Wie Push funktioniert

Alles, was in der Glocke landet (Tabelle `notifications`), geht zusätzlich als Push raus: direkt nach jeder Admin-Aktion (über `after()`), bei kurzfristigen Abmeldungen und beim täglichen Cron. Bei mehr als 3 neuen Benachrichtigungen auf einmal kommt eine Sammel-Push. Abgelaufene Abos (App gelöscht, Erlaubnis entzogen) werden automatisch entfernt. Aktivieren kann man Push pro Gerät unter **Profil**. Lokal funktioniert das in Chrome/Edge auf `http://localhost`, aufs Handy erst nach dem Deployment (HTTPS).

## Projektstruktur

```
src/
  actions/        Server Actions (auth, member, admin)
  app/(app)/      Seiten für eingeloggte Nutzer (+ admin/)
  app/api/        Kalender (.ics, Abo-Feed), Cron, CSV-Export
  app/login/      Login
  components/     UI-Bausteine, Schicht-/Spendenkarten, Admin-Formulare
  lib/            Supabase-Clients, Auth, Datum (immer Europe/Berlin), Kalender, Statistik
  proxy.ts        Session-Refresh + Weiterleitung zum Login
supabase/migrations/   Datenbankschema, RLS, Trigger
```

---

## Mehrschulen-Plattform (Branch `mehrschulen`, noch nicht live)

Auf diesem Branch wird aus dem Tool eine Plattform für beliebig viele Schulen und Jahrgänge.

**Aufbau**
- **Schule → Jahrgang** (`schools`, `cohorts`): Jeder Jahrgang ist komplett abgeschottet. Die Datenbank erzwingt das über `my_cohort_id()` in allen RLS-Policies; Benachrichtigungen „an alle“ gehen nur an den eigenen Jahrgang.
- **Landing Page** auf `/`, **Registrierung** auf `/registrieren` (legt Schule, Jahrgang und den ersten Admin an). Die App liegt jetzt unter `/start`.
- **Login**: weiterhin `vorname.nachname` + Passwort. Jeder Jahrgang hat einen **Login-Link** (`/j/<kennung>`, merkt sich den Jahrgang auf dem Gerät) und einen **Jahrgangs-Code**. Ist ein Benutzername plattformweit eindeutig, braucht es beides nicht.
- **Admin → Jahrgang**: Schulname, Jahrgangsname, Login-Link & Code.
- **Partner-Hub** (`/partner`, Teaser auf Landing Page und Startseite): Partnerangebote, immer als Anzeige gekennzeichnet. Klicks laufen über `/go/<id>` (Zählung + utm-Parameter).
- **Plattform-Bereich** (`/plattform`, nur Plattform-Admins): alle Jahrgänge (sperren/freischalten), Partner pflegen, Klickzahlen.
- Rechtliche Seiten (`/impressum`, `/datenschutz`, `/nutzungsbedingungen`) als **Entwürfe mit Platzhaltern** – vor dem Start ausfüllen und prüfen lassen.

**Migration bestehender Daten**: `supabase/migrations/20261107100000_mehrschulen.sql` legt automatisch „Unsere Schule · Abi 2027“ an und hängt alle vorhandenen Daten daran. Bestehende Logins funktionieren unverändert (interne Domain `abi.local`).

**Entwickeln gegen eine separate Test-Datenbank**
```bash
# .env.staging.local mit den Zugangsdaten des Test-Supabase-Projekts anlegen (gleiche Variablen wie .env.local)
npm run db:push:staging     # alle Migrationen in die Test-DB
npm run dev:staging         # App mit Test-DB starten
npm run make-platform-admin -- vorname.nachname --jahrgang <kennung>
```
Die Variablen aus `.env.staging.local` haben Vorrang vor `.env.local` – die Live-Datenbank wird dabei nicht angefasst.
