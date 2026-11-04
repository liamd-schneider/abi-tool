import type { Metadata } from "next";
import { Bell, CheckCheck } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { clearReadNotifications, markAllNotificationsRead } from "@/actions/member";
import { requireUser } from "@/lib/auth";
import { formatStamp } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import type { NotificationRow } from "@/lib/types";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Benachrichtigungen" };

export default async function NotificationsPage() {
  const me = await requireUser();
  const supabase = await createClient();
  const { data } = await supabase
    .from("notifications")
    .select("id, title, body, link, read_at, created_at")
    .eq("user_id", me.id)
    .order("created_at", { ascending: false })
    .limit(100);
  const notifications = (data ?? []) as NotificationRow[];
  const unread = notifications.filter((n) => !n.read_at).length;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Benachrichtigungen"
        description={unread > 0 ? `${unread} ungelesen` : "Alles gelesen"}
        actions={
          <>
            {unread > 0 ? (
              <ActionForm action={markAllNotificationsRead}>
                <SubmitButton variant="outline" size="sm">
                  <CheckCheck className="size-4" /> Alle gelesen
                </SubmitButton>
              </ActionForm>
            ) : null}
            {notifications.length > unread ? (
              <ActionForm action={clearReadNotifications} confirm="Alle gelesenen Benachrichtigungen löschen?">
                <SubmitButton variant="ghost" size="sm">
                  Gelesene löschen
                </SubmitButton>
              </ActionForm>
            ) : null}
          </>
        }
      />

      {notifications.length === 0 ? (
        <EmptyState icon={<Bell className="size-6" />} title="Keine Benachrichtigungen">
          Hier erscheinen neue Termine, Änderungen an deinen Schichten, Erinnerungen und Abstimmungen.
        </EmptyState>
      ) : (
        <ul className="flex flex-col gap-2">
          {notifications.map((n) => (
            <li key={n.id}>
              {/* Normaler Link (kein Prefetch), markiert beim Öffnen als gelesen */}
              <a
                href={`/api/notifications/${n.id}/open`}
                className={cn(
                  "flex gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/40",
                  !n.read_at && "border-primary/40 bg-primary-soft",
                )}
              >
                <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", n.read_at ? "bg-transparent" : "bg-primary")} />
                <div className="min-w-0 flex-1">
                  <p className={cn("text-sm", !n.read_at && "font-semibold")}>{n.title}</p>
                  {n.body ? <p className="text-sm text-muted-foreground">{n.body}</p> : null}
                  <p className="mt-1 text-xs text-muted-foreground">{formatStamp(n.created_at)}</p>
                </div>
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
