import type { Metadata } from "next";
import { Megaphone, Pin } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, Multiline, PageHeader } from "@/components/ui/misc";
import { requireUser } from "@/lib/auth";
import { formatStamp } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import type { Announcement } from "@/lib/types";

export const metadata: Metadata = { title: "Neuigkeiten" };

export default async function NewsPage() {
  await requireUser();
  const supabase = await createClient();
  const { data } = await supabase
    .from("announcements")
    .select("id, title, body, pinned, created_at, profiles(full_name, username)")
    .order("pinned", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(100);
  const news = (data ?? []) as unknown as Announcement[];

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Neuigkeiten" description="Infos und Ankündigungen vom Abikomitee" />
      {news.length === 0 ? (
        <EmptyState icon={<Megaphone className="size-6" />} title="Noch keine Neuigkeiten" />
      ) : (
        <div className="flex flex-col gap-3">
          {news.map((n) => (
            <Card key={n.id} className={n.pinned ? "border-primary/40" : undefined}>
              <CardHeader>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {n.pinned ? (
                    <span className="inline-flex items-center gap-1 font-medium text-primary">
                      <Pin className="size-3.5" /> Angeheftet
                    </span>
                  ) : null}
                  <span>
                    {formatStamp(n.created_at)}
                    {n.profiles ? ` · ${n.profiles.full_name}` : ""}
                  </span>
                </div>
                <CardTitle className="text-lg">{n.title}</CardTitle>
              </CardHeader>
              {n.body ? (
                <CardContent>
                  <Multiline text={n.body} className="text-sm" />
                </CardContent>
              ) : null}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
