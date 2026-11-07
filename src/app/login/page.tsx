import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Logo } from "@/components/app-header";
import { Card, CardContent } from "@/components/ui/card";
import { getCurrentProfile } from "@/lib/auth";
import { COHORT_COOKIE, cohortLabel, findCohort } from "@/lib/cohorts";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Anmelden" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; code?: string; unbekannt?: string }>;
}) {
  const profile = await getCurrentProfile();
  if (profile) redirect("/start");
  const { next, code, unbekannt } = await searchParams;

  const remembered = await findCohort((await cookies()).get(COHORT_COOKIE)?.value);

  return (
    <main className="flex min-h-dvh flex-1 items-center justify-center p-4">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <Link href="/" className="flex flex-col items-center gap-3 text-center">
          <div className="scale-150">
            <Logo />
          </div>
          <div className="mt-2">
            <h1 className="text-2xl font-bold tracking-tight">Abi-Tool</h1>
            <p className="text-sm text-muted-foreground">Termine, Schichten & Abstimmungen für euren Jahrgang</p>
          </div>
        </Link>

        <Card>
          <CardContent className="pt-5 sm:pt-6">
            {unbekannt ? (
              <p className="mb-4 rounded-lg bg-warning/15 p-3 text-sm">
                Diesen Login-Link kennen wir nicht. Gib stattdessen euren Jahrgangs-Code ein.
              </p>
            ) : null}
            <LoginForm
              next={next ?? ""}
              remembered={remembered?.active ? { slug: remembered.slug, label: cohortLabel(remembered) } : null}
              initialCode={code ?? ""}
            />
          </CardContent>
        </Card>

        <div className="flex flex-col gap-1 text-center text-xs text-muted-foreground">
          <p>Noch keinen Zugang oder Passwort vergessen? Melde dich bei eurem Abikomitee.</p>
          <p>Du bleibst auf diesem Gerät angemeldet, bis du dich abmeldest.</p>
          <p className="mt-2">
            Euer Jahrgang ist noch nicht dabei?{" "}
            <Link href="/registrieren" className="font-medium text-primary hover:underline">
              Kostenlos registrieren
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
