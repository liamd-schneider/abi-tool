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
- **Benachrichtigungen:** neue Termine, Neuigkeiten und Abstimmungen, geänderte/gestrichene Schichten, Erinnerung am Vortag
- **Kalender ohne Google-API:** „Zu Google Kalender“-Button, `.ics`-Download und persönlicher Abo-Link (webcal) für alle Termine + eigene Schichten
- Login mit **Benutzername + Passwort** (`vorname.nachname`), man bleibt dauerhaft eingeloggt; als App auf den Homescreen legbar

**Für Admins (`/admin`)**
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
| `DATABASE_URL` | nur für Migrationen (`npm run db:push`), nicht auf Vercel nötig |

## Datenbank

Das Schema liegt in [`supabase/migrations/`](supabase/migrations). Neue Migration anlegen und einspielen:

```bash
npx supabase migration new <name>   # SQL-Datei bearbeiten
npm run db:push                     # spielt neue Migrationen ein
```

Alle Zugriffsrechte sind per Row Level Security in der Datenbank geregelt: Mitglieder können nur ihre eigenen Einträge ändern, Admins alles, ohne Login gibt es keine Daten.

**Wichtig in Supabase:** Authentication → Sign In / Providers → „Allow new users to sign up“ muss **aus** sein. Accounts legen nur Admins an.

## Accounts

```bash
npm run create-admin -- "Vorname Nachname"   # ersten Admin anlegen (gibt Passwort aus)
```

Alle weiteren Accounts im Browser unter **Admin → Mitglieder**: Namensliste einfügen → Benutzernamen und Startpasswörter werden erzeugt.

## Deployment (Vercel)

1. Repo in Vercel importieren (Framework: Next.js, keine weiteren Einstellungen nötig).
2. Unter *Settings → Environment Variables* setzen: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `AUTH_USERNAME_EMAIL_DOMAIN`, `CRON_SECRET`.
3. Deployen. Der Cron-Job aus [`vercel.json`](vercel.json) läuft täglich um 15:00 UTC (16/17 Uhr deutscher Zeit) und erinnert an Schichten der nächsten 36 Stunden.

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
