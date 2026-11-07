import type { ReactNode } from "react";
import { LogOut } from "lucide-react";
import { AppHeader, Logo } from "@/components/app-header";
import { MobileNav } from "@/components/nav";
import { ServiceWorkerRegistrar } from "@/components/push";
import { Button } from "@/components/ui/button";
import { logout } from "@/actions/auth";
import { getCurrentCohort, isPlatformAdmin, requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const profile = await requireUser();
  const [cohort, platformAdmin] = await Promise.all([getCurrentCohort(), isPlatformAdmin()]);

  // Jahrgang gesperrt oder noch nicht freigeschaltet → nichts anzeigen
  // (die Datenbank liefert dann ohnehin keine Daten mehr)
  if (!cohort) {
    const { data: state } = await createAdminClient()
      .from("cohorts")
      .select("pending, active")
      .eq("id", profile.cohort_id)
      .maybeSingle();
    const pending = Boolean(state?.pending && state.active);
    return (
      <main className="flex min-h-dvh flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
        <Logo />
        <h1 className="text-xl font-semibold">{pending ? "Fast geschafft!" : "Dieser Jahrgang ist gerade gesperrt"}</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          {pending
            ? "Euer Jahrgang ist registriert und wird gerade geprüft. Sobald er freigeschaltet ist, kannst du loslegen – das dauert meist nicht lange."
            : "Bitte wende dich an euer Abikomitee. Wenn ihr glaubt, dass das ein Fehler ist, meldet euch beim Plattform-Team (Kontakt im Impressum)."}
        </p>
        <form action={logout}>
          <Button type="submit" variant="outline">
            <LogOut className="size-4" /> Abmelden
          </Button>
        </form>
      </main>
    );
  }

  const supabase = await createClient();
  const { count } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", profile.id)
    .is("read_at", null);

  return (
    <>
      <AppHeader profile={profile} unread={count ?? 0} platformAdmin={platformAdmin} />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pt-6 pb-28 md:pb-16">{children}</main>
      <MobileNav />
      <ServiceWorkerRegistrar />
    </>
  );
}
