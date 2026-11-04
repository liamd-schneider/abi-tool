import type { Metadata } from "next";
import { Pin, PinOff, Send, Trash } from "lucide-react";
import { ActionForm, Hidden, SubmitButton } from "@/components/action-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox, Field, Input, Textarea } from "@/components/ui/input";
import { EmptyState, Multiline, PageHeader, SectionTitle } from "@/components/ui/misc";
import { createAnnouncement, deleteAnnouncement, setAnnouncementPinned } from "@/actions/admin";
import { formatStamp } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import type { Announcement } from "@/lib/types";

export const metadata: Metadata = { title: "Neuigkeiten verwalten" };

export default async function AdminNewsPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("announcements")
    .select("id, title, body, pinned, created_at, profiles(full_name, username)")
    .order("pinned", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(100);
  const news = (data ?? []) as unknown as Announcement[];

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Neuigkeiten" description="Alle Mitglieder bekommen bei neuen Beiträgen eine Benachrichtigung." className="mb-0" />

      <Card>
        <CardHeader>
          <CardTitle>Neuer Beitrag</CardTitle>
        </CardHeader>
        <CardContent>
          <ActionForm action={createAnnouncement} resetOnSuccess className="flex flex-col gap-3">
            <Field label="Titel *" htmlFor="news-title">
              <Input id="news-title" name="title" required maxLength={200} placeholder="z. B. Abiball-Location steht fest!" />
            </Field>
            <Field label="Text" htmlFor="news-body">
              <Textarea id="news-body" name="body" rows={5} />
            </Field>
            <Checkbox name="pinned" label="Oben anheften" />
            <div>
              <SubmitButton>
                <Send className="size-4" /> Veröffentlichen
              </SubmitButton>
            </div>
          </ActionForm>
        </CardContent>
      </Card>

      <section>
        <SectionTitle>Bisherige Beiträge</SectionTitle>
        {news.length === 0 ? (
          <EmptyState title="Noch keine Beiträge" />
        ) : (
          <div className="flex flex-col gap-3">
            {news.map((n) => (
              <Card key={n.id} className={n.pinned ? "border-primary/40" : undefined}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs text-muted-foreground">
                        {formatStamp(n.created_at)}
                        {n.profiles ? ` · ${n.profiles.full_name}` : ""}
                      </p>
                      <CardTitle>{n.title}</CardTitle>
                    </div>
                    <div className="flex gap-1">
                      <ActionForm action={setAnnouncementPinned}>
                        <Hidden name="id" value={n.id} />
                        <Hidden name="pinned" value={!n.pinned} />
                        <SubmitButton variant="ghost" size="icon" title={n.pinned ? "Lösen" : "Anheften"} aria-label={n.pinned ? "Lösen" : "Anheften"}>
                          {n.pinned ? <PinOff className="size-4" /> : <Pin className="size-4" />}
                        </SubmitButton>
                      </ActionForm>
                      <ActionForm action={deleteAnnouncement} confirm="Beitrag löschen?">
                        <Hidden name="id" value={n.id} />
                        <SubmitButton variant="destructive-ghost" size="icon" aria-label="Löschen">
                          <Trash className="size-4" />
                        </SubmitButton>
                      </ActionForm>
                    </div>
                  </div>
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
      </section>
    </div>
  );
}
