import type { ReactNode } from "react";
import { AppHeader } from "@/components/app-header";
import { MobileNav } from "@/components/nav";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const profile = await requireUser();
  const supabase = await createClient();
  const { count } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", profile.id)
    .is("read_at", null);

  return (
    <>
      <AppHeader profile={profile} unread={count ?? 0} />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pt-6 pb-28 md:pb-16">{children}</main>
      <MobileNav />
    </>
  );
}
