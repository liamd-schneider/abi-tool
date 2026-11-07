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

## Sicherheit (Branch `mehrschulen`)

**Zugang**
- Login-Cookies sind `httpOnly` + `SameSite=Lax` (+ `Secure` in Produktion) – Browser-Skripte kommen nicht an die Tokens.
- **Zwei-Faktor-Anmeldung** (Authenticator-App, TOTP) für alle; **Pflicht für Plattform-Admins**, pro Jahrgang als Pflicht für Admins einschaltbar. Erzwungen in der App *und* in der Datenbank (`aal2` im JWT). Wiederherstellungscodes, falls auf dem Supabase-Server freigeschaltet; sonst setzen Admins die 2FA einer Person zurück.
- **Brute-Force-Schutz**: max. 8 Fehlversuche pro Account und 40 Anfragen pro IP in 15 Minuten, max. 5 Registrierungen pro IP und Stunde. IPs werden nur gesalzen gehasht gespeichert.
- **Passwörter**: mind. 10 Zeichen, keine Klassiker, nicht der eigene Name/die Schule, Abgleich mit bekannten Datenlecks über *Have I Been Pwned* (k-Anonymität – das Passwort verlässt nie den Server). Admin-Startpasswörter: 12 zufällige Zeichen.
- Passwort ändern meldet alle anderen Geräte ab; Passwort-Reset durch Admins beendet alle Sitzungen der Person. „Auf allen Geräten abmelden“ im Profil.
- Gefährliche Aktionen (Account löschen, Jahrgang löschen, 2FA ausschalten) verlangen das Passwort erneut.
- Registrierung: Honeypot, Mindest-Ausfüllzeit, Rate-Limit und optional **Cloudflare Turnstile**. Optional **Freischaltung** neuer Jahrgänge durch Plattform-Admins (`REGISTRATION_MODE=approval`).

**Daten**
- Jeder Jahrgang ist per RLS abgeschottet; Admin-Rechte gelten nur im eigenen Jahrgang. Wo der Secret Key RLS umgeht, wird der Jahrgang im Code zusätzlich geprüft.
- Spalten-Rechte: Kalender-Schlüssel anderer sind unsichtbar; Mitglieder/Admins können nur erlaubte Spalten ändern; „Erstellt von“ ist nicht fälschbar; jeder Jahrgang behält mindestens einen Admin.
- `anon` hat keinerlei Rechte (auch nicht auf künftige Tabellen/Funktionen); Server-Funktionen (Rate-Limits, Wartung, Sitzungen beenden) nur für `service_role`.
- **Audit-Protokoll** aller sicherheitsrelevanten Aktionen (Admin → Protokoll, Plattform → Protokoll).
- **DSGVO**: „Meine Daten herunterladen“ (JSON), Account selbst löschen, ganzen Jahrgang löschen. Tägliche Bereinigung: Benachrichtigungen > 180 Tage, Partner-Klicks nach 90 Tagen anonymisiert, Protokoll > 400 Tage, Rate-Limit-Daten > 2 Tage.
- Fehlermeldungen geben keine internen Datenbank-Details preis.

**Browser & Server**
- Strenge **Content-Security-Policy** mit Nonce pro Anfrage (`strict-dynamic`, kein `unsafe-eval` in Produktion, `object-src 'none'`, `frame-ancestors 'none'`, `form-action 'self'`).
- HSTS (2 Jahre, preload), `X-Frame-Options: DENY`, `nosniff`, Referrer-Policy, Permissions-Policy, COOP, kein `X-Powered-By`.
- Schutz vor Open-Redirects, CSRF-Prüfung der eigenen API-Routen, zeitkonstanter Vergleich des Cron-Secrets, Partner-Klicks gegen Manipulation gedrosselt.
- `/.well-known/security.txt` für Sicherheitsmeldungen.

**Zusätzliche Umgebungsvariablen (alle optional)**

| Variable | Wofür |
|---|---|
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET_KEY` | Cloudflare Turnstile auf der Registrierung (kostenlos bei Cloudflare) |
| `REGISTRATION_MODE` | `open` (Standard) oder `approval` (Plattform-Admins schalten neue Jahrgänge frei) |
| `RATE_LIMIT_SALT` | Salz für gehashte IPs/Benutzernamen (Standard: `CRON_SECRET`) |
| `SECURITY_CONTACT` | E-Mail für `security.txt` (Standard: Link aufs Impressum) |

**In Supabase einstellen (Dashboard)**
1. Authentication → Sign In / Providers: „Allow new users to sign up“ **aus** (Accounts entstehen nur serverseitig).
2. Authentication → Multi-Factor: **TOTP aktiviert** lassen.
3. Authentication → Sessions/JWT: Access-Token-Laufzeit 3600 s (Standard) lassen.
4. Authentication → Rate Limits: Standardwerte lassen.
5. Wenn verfügbar (Pro): „Leaked password protection“ und Wiederherstellungscodes aktivieren, Point-in-Time-Backups einschalten.
6. In Vercel alle Secrets als **Sensitive** markieren.
