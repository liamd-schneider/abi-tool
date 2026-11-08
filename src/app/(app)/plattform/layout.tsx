import type { ReactNode } from "react";
import { PlatformNav } from "@/components/nav";
import { requirePlatformAdmin } from "@/lib/auth";

export default async function PlatformLayout({ children }: { children: ReactNode }) {
  await requirePlatformAdmin();
  return (
    <div>
      <p className="mb-2 text-xs font-semibold tracking-wider text-primary uppercase">System-Admin · alle Schulen</p>
      <PlatformNav />
      {children}
    </div>
  );
}
