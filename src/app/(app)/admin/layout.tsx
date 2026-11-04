import type { ReactNode } from "react";
import { AdminNav } from "@/components/nav";
import { requireAdmin } from "@/lib/auth";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requireAdmin();
  return (
    <div>
      <p className="mb-2 text-xs font-semibold tracking-wider text-primary uppercase">Admin-Bereich</p>
      <AdminNav />
      {children}
    </div>
  );
}
