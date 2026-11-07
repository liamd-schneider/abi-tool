"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, Cake, Clock, House, Vote } from "lucide-react";
import { cn } from "@/lib/utils";

const MAIN_ITEMS = [
  { href: "/start", label: "Start", icon: House },
  { href: "/termine", label: "Termine", icon: CalendarDays },
  { href: "/schichten", label: "Schichten", icon: Clock },
  { href: "/dienste", label: "Dienste", icon: Cake },
  { href: "/abstimmungen", label: "Umfragen", icon: Vote },
];

const ADMIN_ITEMS = [
  { href: "/admin", label: "Übersicht" },
  { href: "/admin/termine", label: "Termine & Schichten" },
  { href: "/admin/mitglieder", label: "Mitglieder" },
  { href: "/admin/jahrgang", label: "Jahrgang" },
  { href: "/admin/protokoll", label: "Protokoll" },
  { href: "/admin/neuigkeiten", label: "Neuigkeiten" },
  { href: "/admin/abstimmungen", label: "Abstimmungen" },
  { href: "/admin/statistik", label: "Statistik" },
];

function isActive(pathname: string, href: string, exact = false) {
  if (href === "/" || exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function DesktopNav() {
  const pathname = usePathname();
  return (
    <nav className="hidden items-center gap-1 md:flex">
      {MAIN_ITEMS.map(({ href, label }) => (
        <Link
          key={href}
          href={href}
          className={cn(
            "rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
            isActive(pathname, href) && "bg-primary-soft text-primary hover:bg-primary-soft hover:text-primary",
          )}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}

export function MobileNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
      <div className="mx-auto grid max-w-md grid-cols-5">
        {MAIN_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium text-muted-foreground",
                active && "text-primary",
              )}
            >
              <Icon className={cn("size-5", active && "stroke-[2.4]")} aria-hidden />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav className="-mx-4 mb-6 flex gap-1 overflow-x-auto border-b border-border px-4 pb-px">
      {ADMIN_ITEMS.map(({ href, label }) => {
        const active = isActive(pathname, href, href === "/admin");
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "border-b-2 border-transparent px-3 py-2 text-sm font-medium whitespace-nowrap text-muted-foreground hover:text-foreground",
              active && "border-primary text-primary hover:text-primary",
            )}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
