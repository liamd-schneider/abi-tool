import type { ReactNode } from "react";
import { AdminWalkthrough } from "@/components/admin/walkthrough";
import { AdminNav } from "@/components/nav";
import { requireAdmin } from "@/lib/auth";
import { pushPublicKey } from "@/lib/push";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const me = await requireAdmin();
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs font-semibold tracking-wider text-primary uppercase">Admin-Bereich</p>
        <AdminWalkthrough autoStart={!me.admin_tour_done_at} vapidKey={pushPublicKey()} />
      </div>
      <AdminNav />
      {children}
    </div>
  );
}
