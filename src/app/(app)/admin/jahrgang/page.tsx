import type { Metadata } from "next";
import { KeyRound, Link2, RefreshCw, School } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { CopyButton } from "@/components/copy-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/misc";
import { regenerateJoinCode, saveCohortSettings } from "@/actions/admin";
import { getCurrentCohort, requireAdmin } from "@/lib/auth";
import { getOrigin } from "@/lib/request";

export const metadata: Metadata = { title: "Jahrgang" };

export default async function CohortSettingsPage() {
  await requireAdmin();
  const cohort = await getCurrentCohort();
  if (!cohort) return null;
  const loginLink = `${await getOrigin()}/j/${cohort.slug}`;

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
    </div>
  );
}
