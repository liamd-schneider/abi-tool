import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { logout } from "@/actions/auth";
import { getAal, getCurrentProfile } from "@/lib/auth";
import { safeNextPath } from "@/lib/safe-path";
import { SecondFactorForm } from "./second-factor-form";

export const metadata: Metadata = { title: "Zwei-Faktor-Anmeldung" };

export default async function SecondFactorPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  const { next } = await searchParams;
  const target = safeNextPath(next);
  const aal = await getAal();
  if (aal.current === "aal2" || aal.next !== "aal2") redirect(target);

  return (
    <main className="flex min-h-dvh flex-1 items-center justify-center p-4">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <ShieldCheck className="size-6" />
          </span>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Zwei-Faktor-Anmeldung</h1>
            <p className="text-sm text-muted-foreground">Hallo {profile.full_name.split(" ")[0]}! Gib den Code aus deiner Authenticator-App ein.</p>
          </div>
        </div>
        <Card>
          <CardContent className="pt-5 sm:pt-6">
            <SecondFactorForm next={target} />
          </CardContent>
        </Card>
        <form action={logout} className="text-center">
          <button type="submit" className="text-sm text-muted-foreground hover:text-foreground hover:underline">
            Abbrechen und abmelden
          </button>
        </form>
      </div>
    </main>
  );
}
