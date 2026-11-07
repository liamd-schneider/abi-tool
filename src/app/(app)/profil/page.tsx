import type { Metadata } from "next";
import { headers } from "next/headers";
import { BellRing, CalendarSync, KeyRound, LogOut, RefreshCw } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { CopyButton } from "@/components/copy-button";
import { PushToggle } from "@/components/push";
import { pushPublicKey } from "@/lib/push";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";
import { Avatar, Notice } from "@/components/ui/misc";
import { changePassword, logout } from "@/actions/auth";
import { regenerateCalendarToken } from "@/actions/member";
import Link from "next/link";
import { getAal, getCurrentCohort, isPlatformAdmin, requireUser } from "@/lib/auth";
import { TwoFactorSettings } from "@/components/security-settings";
import { deleteOwnAccount, logoutEverywhere } from "@/actions/security";
import { Download, MonitorSmartphone, ShieldCheck, Trash } from "lucide-react";
import { cohortLabel } from "@/lib/cohort-label";
import { formatHours } from "@/lib/dates";
import { loadMemberStats } from "@/lib/stats";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Profil" };

export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ zweifaktor?: string }> }) {
  const me = await requireUser();
  const { zweifaktor } = await searchParams;
  const [cohort, platformAdmin, aal] = await Promise.all([getCurrentCohort(), isPlatformAdmin(), getAal()]);
  const supabase = await createClient();
  const [stats, { data: calendarToken }] = await Promise.all([
    loadMemberStats(supabase).then((all) => all.find((s) => s.id === me.id)),
    supabase.rpc("my_calendar_token"),
  ]);

  const mfaEnabled = aal.next === "aal2";
  const mfaRequired = platformAdmin
    ? "Für Plattform-Admins ist die Zwei-Faktor-Anmeldung Pflicht."
    : me.role === "admin" && cohort?.require_admin_2fa
      ? "Euer Jahrgang verlangt die Zwei-Faktor-Anmeldung für Admins."
      : null;

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const feedUrl = `${proto}://${host}/api/calendar/${calendarToken ?? ""}.ics`;
  const webcalUrl = feedUrl.replace(/^https?:\/\//, "webcal://");
  const googleSubscribeUrl = `https://calendar.google.com/calendar/render?cid=${encodeURIComponent(webcalUrl)}`;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div className="flex items-center gap-4">
        <Avatar name={me.full_name} className="size-14 text-lg" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{me.full_name}</h1>
          <p className="text-sm text-muted-foreground">
            @{me.username} {me.role === "admin" ? <Badge className="ml-1">Admin</Badge> : null}
          </p>
          {cohort ? <p className="text-sm text-muted-foreground">{cohortLabel(cohort)}</p> : null}
          {platformAdmin ? (
            <Link href="/plattform" className="text-sm font-medium text-primary hover:underline">
              Plattform-Bereich →
            </Link>
          ) : null}
        </div>
      </div>

      {stats ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Schichten geleistet", value: stats.shiftsDone },
            { label: "Stunden geleistet", value: formatHours(stats.hoursDone) },
            { label: "Schichten geplant", value: stats.shiftsUpcoming },
            { label: "Spenden & Dienste", value: stats.pledges },
          ].map((s) => (
            <Card key={s.label}>
              <CardContent className="pt-4 sm:pt-4">
                <p className="text-2xl font-bold tabular-nums">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BellRing className="size-5 text-primary" /> Push-Benachrichtigungen
          </CardTitle>
          <CardDescription>
            Erinnerungen an deine Schichten, neue Termine, Abstimmungen und Neuigkeiten direkt aufs Handy. Gilt pro Gerät.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PushToggle vapidKey={pushPublicKey()} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarSync className="size-5 text-primary" /> Kalender-Abo
          </CardTitle>
          <CardDescription>
            Alle Termine und deine eigenen Schichten automatisch im Handy-Kalender – aktualisiert sich von selbst.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            <a href={webcalUrl} className={buttonVariants({ size: "sm" })}>
              iPhone / Outlook abonnieren
            </a>
            <a href={googleSubscribeUrl} target="_blank" rel="noopener noreferrer" className={buttonVariants({ variant: "outline", size: "sm" })}>
              In Google Kalender abonnieren
            </a>
            <CopyButton text={feedUrl} label="Link kopieren" />
          </div>
          <p className="text-xs break-all text-muted-foreground">{feedUrl}</p>
          <Notice tone="info">
            Der Link ist persönlich – nicht weitergeben. Google aktualisiert abonnierte Kalender nur alle paar Stunden;
            Apple meist stündlich. Lokal (localhost) funktioniert das Abo mit Google nicht, erst auf der echten Website.
          </Notice>
          <ActionForm action={regenerateCalendarToken} confirm="Neuen Link erzeugen? Der alte Link funktioniert dann nicht mehr.">
            <SubmitButton variant="ghost" size="sm">
              <RefreshCw className="size-4" /> Neuen Link erzeugen
            </SubmitButton>
          </ActionForm>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="size-5 text-primary" /> Passwort ändern
          </CardTitle>
          <CardDescription>Am besten direkt nach dem ersten Login dein Startpasswort ändern.</CardDescription>
        </CardHeader>
        <CardContent>
          <ActionForm action={changePassword} resetOnSuccess className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <input type="text" name="username" autoComplete="username" value={me.username} readOnly hidden />
            <Field label="Neues Passwort" htmlFor="password">
              <Input id="password" name="password" type="password" minLength={10} autoComplete="new-password" required />
            </Field>
            <Field label="Wiederholen" htmlFor="confirm">
              <Input id="confirm" name="confirm" type="password" minLength={10} autoComplete="new-password" required />
            </Field>
            <div className="sm:col-span-2">
              <SubmitButton>Passwort speichern</SubmitButton>
            </div>
          </ActionForm>
        </CardContent>
      </Card>

      <Card id="sicherheit" className={zweifaktor ? "scroll-mt-20 border-warning/60" : "scroll-mt-20"}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="size-5 text-primary" /> Zwei-Faktor-Anmeldung
          </CardTitle>
          <CardDescription>
            Zusätzlich zum Passwort ein Code aus einer Authenticator-App – selbst wer dein Passwort kennt, kommt dann nicht rein.
            {me.role === "admin" ? " Für Admins dringend empfohlen." : ""}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TwoFactorSettings enabled={mfaEnabled} required={mfaRequired} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MonitorSmartphone className="size-5 text-primary" /> Geräte & Daten
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <form action={logout}>
            <Button type="submit" variant="outline">
              <LogOut className="size-4" /> Abmelden
            </Button>
          </form>
          <form action={logoutEverywhere}>
            <Button type="submit" variant="outline">
              <LogOut className="size-4" /> Auf allen Geräten abmelden
            </Button>
          </form>
          <a href="/api/me/export" className={buttonVariants({ variant: "outline" })}>
            <Download className="size-4" /> Meine Daten herunterladen
          </a>
        </CardContent>
      </Card>

      <details className="rounded-xl border border-destructive/40 bg-card">
        <summary className="flex cursor-pointer items-center gap-2 p-4 font-semibold text-destructive">
          <Trash className="size-4" /> Account löschen
        </summary>
        <div className="border-t border-border p-4">
          <p className="mb-3 text-sm text-muted-foreground">
            Dein Account und alle deine Eintragungen (Schichten, Spenden, Stimmen, Anmerkungen) werden endgültig gelöscht.
          </p>
          <ActionForm action={deleteOwnAccount} confirm="Account wirklich endgültig löschen?" className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Zur Bestätigung LÖSCHEN eintippen" htmlFor="delete-confirm">
              <Input id="delete-confirm" name="confirm" required autoComplete="off" />
            </Field>
            <Field label="Dein Passwort" htmlFor="delete-password">
              <Input id="delete-password" name="password" type="password" required autoComplete="current-password" />
            </Field>
            <div className="sm:col-span-2">
              <SubmitButton variant="destructive">Account endgültig löschen</SubmitButton>
            </div>
          </ActionForm>
        </div>
      </details>
    </div>
  );
}
