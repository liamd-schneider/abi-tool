import type { Metadata } from "next";
import { KeyRound, Link2, RefreshCw, School, ShieldCheck, Trash } from "lucide-react";
import { ActionForm, Hidden, SubmitButton } from "@/components/action-form";
import { CopyButton } from "@/components/copy-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/misc";
import { deleteCohort, regenerateJoinCode, saveCohortSettings, setRequireAdmin2fa } from "@/actions/admin";
import { getAal, getCurrentCohort, requireAdmin } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { getOrigin } from "@/lib/request";

export const metadata: Metadata = { title: "Jahrgang" };

export default async function CohortSettingsPage() {
  await requireAdmin();
  const cohort = await getCurrentCohort();
  if (!cohort) return null;
  const loginLink = `${await getOrigin()}/j/${cohort.slug}`;
  const myAal = (await getAal()).current;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Jahrgang" description="Schule, Name des Jahrgangs und der Zugang für alle." className="mb-0" />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link2 className="size-5 text-primary" /> So melden sich alle an
          </CardTitle>
          <CardDescription>
            Schick den Login-Link zusammen mit den Zugangsdaten. Wer den Link einmal geöffnet hat, muss den Jahrgang nie wieder
            angeben.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <p className="text-sm font-medium">Login-Link</p>
            <div className="flex flex-wrap items-center gap-2">
              <code className="min-w-0 flex-1 rounded-lg bg-muted px-3 py-2 text-sm break-all">{loginLink}</code>
              <CopyButton text={loginLink} label="Kopieren" />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <p className="text-sm font-medium">Jahrgangs-Code</p>
            <div className="flex flex-wrap items-center gap-2">
              <code className="rounded-lg bg-muted px-3 py-2 font-mono text-lg font-bold tracking-widest">{cohort.join_code}</code>
              <CopyButton text={cohort.join_code} label="Kopieren" />
            </div>
            <p className="text-xs text-muted-foreground">
              Nur nötig, wenn jemand ohne Link einloggt und es den Benutzernamen an einer anderen Schule auch gibt.
            </p>
          </div>
          <ActionForm action={regenerateJoinCode} confirm="Neuen Code erzeugen? Der alte Code funktioniert danach nicht mehr.">
            <SubmitButton variant="ghost" size="sm">
              <RefreshCw className="size-4" /> Neuen Code erzeugen
            </SubmitButton>
          </ActionForm>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <School className="size-5 text-primary" /> Schule & Jahrgang
          </CardTitle>
          <CardDescription>So erscheint euer Jahrgang beim Login und in der App.</CardDescription>
        </CardHeader>
        <CardContent>
          <ActionForm action={saveCohortSettings} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Name der Schule" htmlFor="school_name" className="sm:col-span-2">
              <Input id="school_name" name="school_name" defaultValue={cohort.schools?.name ?? ""} required maxLength={160} />
            </Field>
            <Field label="Ort" htmlFor="city">
              <Input id="city" name="city" defaultValue={cohort.schools?.city ?? ""} maxLength={100} />
            </Field>
            <Field label="Abi-Jahr" htmlFor="grad_year">
              <Input id="grad_year" name="grad_year" type="number" min={2000} max={2100} defaultValue={cohort.grad_year ?? ""} />
            </Field>
            <Field label="Name des Jahrgangs" htmlFor="cohort_name" className="sm:col-span-2">
              <Input id="cohort_name" name="cohort_name" defaultValue={cohort.name} required maxLength={80} />
            </Field>
            <div className="sm:col-span-2">
              <SubmitButton>Speichern</SubmitButton>
            </div>
          </ActionForm>
        </CardContent>
      </Card>

      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <KeyRound className="size-3.5" /> Interne Kennung: {cohort.slug}
      </p>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="size-5 text-primary" /> Zwei-Faktor-Anmeldung für Admins
            {cohort.require_admin_2fa ? <Badge variant="success">Pflicht</Badge> : <Badge variant="muted">freiwillig</Badge>}
          </CardTitle>
          <CardDescription>
            Wenn Pflicht: Admin-Rechte gelten nur in Sitzungen, die mit Authenticator-App bestätigt wurden – auch direkt in der
            Datenbank. Schützt euren Jahrgang, falls ein Admin-Passwort in falsche Hände gerät.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {!cohort.require_admin_2fa && myAal !== "aal2" ? (
            <p className="text-sm text-muted-foreground">
              Richte zuerst selbst die Zwei-Faktor-Anmeldung im{" "}
              <a href="/profil#sicherheit" className="font-medium text-primary hover:underline">
                Profil
              </a>{" "}
              ein.
            </p>
          ) : null}
          <ActionForm
            action={setRequireAdmin2fa}
            confirm={
              cohort.require_admin_2fa
                ? "2FA-Pflicht für Admins wirklich ausschalten?"
                : "2FA für alle Admins verpflichtend machen? Admins ohne 2FA verlieren ihre Rechte, bis sie 2FA eingerichtet haben."
            }
          >
            <Hidden name="enabled" value={!cohort.require_admin_2fa} />
            <SubmitButton variant={cohort.require_admin_2fa ? "outline" : "primary"} size="sm" disabled={!cohort.require_admin_2fa && myAal !== "aal2"}>
              {cohort.require_admin_2fa ? "Pflicht ausschalten" : "Für alle Admins verpflichtend machen"}
            </SubmitButton>
          </ActionForm>
        </CardContent>
      </Card>

      <details className="rounded-xl border border-destructive/40 bg-card">
        <summary className="flex cursor-pointer items-center gap-2 p-4 font-semibold text-destructive">
          <Trash className="size-4" /> Jahrgang endgültig löschen
        </summary>
        <div className="border-t border-border p-4">
          <p className="mb-3 text-sm text-muted-foreground">
            Löscht den Jahrgang mit <b>allen Accounts</b>, Terminen, Schichten, Spenden, Abstimmungen und Nachrichten – z. B. nach dem
            Abi. Das lässt sich nicht rückgängig machen.
          </p>
          <ActionForm
            action={deleteCohort}
            confirm="Wirklich ALLES endgültig löschen? Alle Mitglieder verlieren sofort ihren Zugang."
            className="grid grid-cols-1 gap-3 sm:grid-cols-2"
          >
            <Field label={`Zur Bestätigung „${cohort.name}“ eintippen`} htmlFor="cohort-confirm">
              <Input id="cohort-confirm" name="confirm" required autoComplete="off" />
            </Field>
            <Field label="Dein Passwort" htmlFor="cohort-password">
              <Input id="cohort-password" name="password" type="password" required autoComplete="current-password" />
            </Field>
            <div className="sm:col-span-2">
              <SubmitButton variant="destructive">Jahrgang endgültig löschen</SubmitButton>
            </div>
          </ActionForm>
        </div>
      </details>
    </div>
  );
}
