import type { ReactNode } from "react";
import Link from "next/link";
import { Logo } from "@/components/app-header";
import { buttonVariants } from "@/components/ui/button";

export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/85 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-3 px-4">
          <Link href="/" className="flex items-center gap-2 font-bold tracking-tight">
            <Logo />
            <span>Abi-Tool</span>
          </Link>
          <nav className="ml-6 hidden items-center gap-5 text-sm text-muted-foreground md:flex">
            <Link href="/#funktionen" className="hover:text-foreground">
              Funktionen
            </Link>
            <Link href="/#so-gehts" className="hover:text-foreground">
              So geht’s
            </Link>
            <Link href="/#partner" className="hover:text-foreground">
              Partner
            </Link>
            <Link href="/#faq" className="hover:text-foreground">
              FAQ
            </Link>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <Link href="/login" className={buttonVariants({ variant: "ghost", size: "sm" })}>
              Anmelden
            </Link>
            <Link href="/registrieren" className={buttonVariants({ size: "sm" })}>
              <span className="sm:hidden">Registrieren</span>
              <span className="hidden sm:inline">Jahrgang registrieren</span>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-border">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Logo />
            <span>Abi-Tool · Organisation für Abi-Jahrgänge</span>
          </div>
          <nav className="flex flex-wrap gap-x-5 gap-y-2">
            <Link href="/impressum" className="hover:text-foreground">
              Impressum
            </Link>
            <Link href="/datenschutz" className="hover:text-foreground">
              Datenschutz
            </Link>
            <Link href="/nutzungsbedingungen" className="hover:text-foreground">
              Nutzungsbedingungen
            </Link>
            <Link href="/login" className="hover:text-foreground">
              Anmelden
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
