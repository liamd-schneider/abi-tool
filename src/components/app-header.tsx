import Link from "next/link";
import { Bell, Building2, Gift, Megaphone, Shield } from "lucide-react";
import { DesktopNav } from "@/components/nav";
import { Avatar } from "@/components/ui/misc";
import type { Profile } from "@/lib/types";

export function Logo() {
  return (
    <span className="inline-flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
      <svg viewBox="0 0 64 64" className="size-5" aria-hidden>
        <path d="M32 14 6 25l26 11 20-8.5V40h4V25L32 14Z" fill="currentColor" />
        <path d="M18 33v8c0 3.9 6.3 7 14 7s14-3.1 14-7v-8l-14 6-14-6Z" fill="currentColor" opacity=".8" />
      </svg>
    </span>
  );
}

const iconLink =
  "relative inline-flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground";

export function AppHeader({
  profile,
  unread,
  platformAdmin = false,
}: {
  profile: Profile;
  unread: number;
  platformAdmin?: boolean;
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/90 pt-[env(safe-area-inset-top)] backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-3 px-4 sm:gap-4">
        <Link href="/start" className="flex items-center gap-2 font-bold tracking-tight">
          <Logo />
          <span className="hidden min-[400px]:inline">Abi-Tool</span>
        </Link>
        <DesktopNav />
        <div className="ml-auto flex items-center gap-0.5">
          <Link href="/partner" className={iconLink} aria-label="Partner & Angebote" title="Partner & Angebote">
            <Gift className="size-5" />
          </Link>
          {platformAdmin ? (
            <Link href="/plattform" className={`${iconLink} hidden sm:inline-flex`} aria-label="Plattform" title="Plattform">
              <Building2 className="size-5" />
            </Link>
          ) : null}
          <Link href="/neuigkeiten" className={iconLink} aria-label="Neuigkeiten" title="Neuigkeiten">
            <Megaphone className="size-5" />
          </Link>
          <Link href="/benachrichtigungen" className={iconLink} aria-label="Benachrichtigungen" title="Benachrichtigungen">
            <Bell className="size-5" />
            {unread > 0 ? (
              <span className="absolute top-1 right-1 flex min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] leading-4 font-bold text-white">
                {unread > 99 ? "99+" : unread}
              </span>
            ) : null}
          </Link>
          {profile.role === "admin" ? (
            <Link href="/admin" className={`${iconLink} w-auto gap-1.5 px-2 text-sm font-medium`} title="Admin-Bereich">
              <Shield className="size-5" />
              <span className="hidden sm:inline">Admin</span>
            </Link>
          ) : null}
          <Link href="/profil" className="ml-1 rounded-full" aria-label="Profil" title={profile.full_name}>
            <Avatar name={profile.full_name} className="size-8 text-xs" />
          </Link>
        </div>
      </div>
    </header>
  );
}
