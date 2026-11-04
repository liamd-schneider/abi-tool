import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LogIn } from "lucide-react";
import { ActionForm, Hidden, SubmitButton } from "@/components/action-form";
import { Logo } from "@/components/app-header";
import { Card, CardContent } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";
import { login } from "@/actions/auth";
import { getCurrentProfile } from "@/lib/auth";

export const metadata: Metadata = { title: "Anmelden" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const profile = await getCurrentProfile();
  if (profile) redirect("/");
  const { next } = await searchParams;

  return (
    <main className="flex min-h-dvh flex-1 items-center justify-center p-4">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="scale-150">
            <Logo />
          </div>
          <div className="mt-2">
            <h1 className="text-2xl font-bold tracking-tight">Abi-Tool</h1>
            <p className="text-sm text-muted-foreground">Termine, Schichten & Abstimmungen für unseren Jahrgang</p>
          </div>
        </div>

        <Card>
          <CardContent className="pt-5 sm:pt-6">
            <ActionForm action={login} className="flex flex-col gap-4">
              <Hidden name="next" value={next ?? ""} />
              <Field label="Benutzername" htmlFor="username">
                <Input
                  id="username"
                  name="username"
                  placeholder="vorname.nachname"
                  autoComplete="username"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  required
                />
              </Field>
              <Field label="Passwort" htmlFor="password">
                <Input id="password" name="password" type="password" autoComplete="current-password" required />
              </Field>
              <SubmitButton size="lg" className="mt-1 w-full">
                <LogIn className="size-4" /> Anmelden
              </SubmitButton>
            </ActionForm>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          Noch keinen Zugang oder Passwort vergessen? Melde dich beim Abikomitee.
          <br />
          Du bleibst auf diesem Gerät angemeldet, bis du dich abmeldest.
        </p>
      </div>
    </main>
  );
}
