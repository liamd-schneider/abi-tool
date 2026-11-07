import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
      <p className="text-5xl font-bold text-primary">404</p>
      <h1 className="text-xl font-semibold">Seite nicht gefunden</h1>
      <p className="text-sm text-muted-foreground">Vielleicht wurde der Termin gelöscht oder der Link ist falsch.</p>
      <Link href="/start" className={buttonVariants()}>
        Zur Startseite
      </Link>
    </main>
  );
}
