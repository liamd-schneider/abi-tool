import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Rocket } from "lucide-react";
import { ActionForm, Hidden, SubmitButton } from "@/components/action-form";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox, Field, Input } from "@/components/ui/input";
import { registerCohort } from "@/actions/register";
import { getCurrentProfile } from "@/lib/auth";
import { nowMs } from "@/lib/dates";

export const metadata: Metadata = { title: "Jahrgang registrieren" };

export default async function RegisterPage() {
  if (await getCurrentProfile()) redirect("/start");
  const year = new Date(nowMs()).getFullYear();
  const defaultYear = new Date(nowMs()).getMonth() >= 7 ? year + 1 : year; // ab August: Abi im nächsten Jahr

  return (
    <div className="mx-auto w-full max-w-xl px-4 py-10 sm:py-14">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Jahrgang registrieren</h1>
        <p className="mt-2 text-muted-foreground">
          Kostenlos und in zwei Minuten. Du wirst automatisch Admin und kannst danach den ganzen Jahrgang einladen.
        </p>
      </div>

      <Card>
        <CardContent className="pt-5 sm:pt-6">
          <ActionForm action={registerCohort} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Hidden name="started_at" value={nowMs()} />
            {/* Honeypot gegen Bots – für Menschen unsichtbar */}
            <div className="hidden" aria-hidden>
              <label>
                Website
                <input name="website" tabIndex={-1} autoComplete="off" />
              </label>
            </div>

            <p className="text-sm font-semibold sm:col-span-2">Eure Schule</p>
            <Field label="Name der Schule *" htmlFor="school_name" className="sm:col-span-2">
              <Input id="school_name" name="school_name" required maxLength={160} placeholder="z. B. Gymnasium am Markt" />
            </Field>
            <Field label="Ort" htmlFor="city">
              <Input id="city" name="city" maxLength={100} placeholder="z. B. Musterstadt" />
            </Field>
            <Field label="Abi-Jahr *" htmlFor="grad_year">
              <Input id="grad_year" name="grad_year" type="number" min={year - 1} max={year + 4} defaultValue={defaultYear} required />
            </Field>
            <Field label="Name des Jahrgangs" htmlFor="cohort_name" hint="Leer lassen für „Abi <Jahr>“" className="sm:col-span-2">
              <Input id="cohort_name" name="cohort_name" maxLength={80} placeholder={`Abi ${defaultYear}`} />
            </Field>

            <p className="mt-2 text-sm font-semibold sm:col-span-2">Dein Admin-Account</p>
            <Field
              label="Vor- und Nachname *"
              htmlFor="full_name"
              hint="Daraus wird dein Benutzername (vorname.nachname)."
              className="sm:col-span-2"
            >
              <Input id="full_name" name="full_name" required maxLength={120} autoComplete="name" placeholder="Max Mustermann" />
            </Field>
            <Field label="Passwort *" htmlFor="password">
              <Input id="password" name="password" type="password" minLength={8} required autoComplete="new-password" />
            </Field>
            <Field label="Passwort wiederholen *" htmlFor="confirm">
              <Input id="confirm" name="confirm" type="password" minLength={8} required autoComplete="new-password" />
            </Field>

            <Checkbox
              name="accept"
              required
              className="sm:col-span-2"
              label={
                <>
                  Ich stimme den{" "}
                  <Link href="/nutzungsbedingungen" target="_blank" className="font-medium text-primary hover:underline">
                    Nutzungsbedingungen
                  </Link>{" "}
                  und der{" "}
                  <Link href="/datenschutz" target="_blank" className="font-medium text-primary hover:underline">
                    Datenschutzerklärung
                  </Link>{" "}
                  zu.
                </>
              }
            />
            <div className="sm:col-span-2">
              <SubmitButton size="lg" className="w-full">
                <Rocket className="size-4" /> Jahrgang anlegen
              </SubmitButton>
            </div>
          </ActionForm>
        </CardContent>
      </Card>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Euer Jahrgang ist schon dabei?{" "}
        <Link href="/login" className="font-medium text-primary hover:underline">
          Anmelden
        </Link>
      </p>
    </div>
  );
}
