import { Send, Trash } from "lucide-react";
import { ActionForm, Hidden, SubmitButton } from "@/components/action-form";
import { Textarea } from "@/components/ui/input";
import { Avatar, Multiline } from "@/components/ui/misc";
import { addComment, deleteComment } from "@/actions/member";
import { formatStamp } from "@/lib/dates";
import type { CommentRow, Profile } from "@/lib/types";

export function Comments({ eventId, comments, me }: { eventId: string; comments: CommentRow[]; me: Profile }) {
  return (
    <div className="flex flex-col gap-4">
      {comments.length === 0 ? (
        <p className="text-sm text-muted-foreground">Noch keine Anmerkungen. Fragen, Ideen oder Hinweise? Schreib sie hier rein.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {comments.map((c) => (
            <li key={c.id} className="flex gap-3">
              <Avatar name={c.profiles?.full_name ?? "?"} className="mt-0.5" />
              <div className="min-w-0 flex-1 rounded-xl bg-muted px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold">
                    {c.profiles?.full_name ?? "Unbekannt"}{" "}
                    <span className="font-normal text-muted-foreground">· {formatStamp(c.created_at)}</span>
                  </p>
                  {c.user_id === me.id || me.role === "admin" ? (
                    <ActionForm action={deleteComment} confirm="Anmerkung löschen?">
                      <Hidden name="id" value={c.id} />
                      <SubmitButton variant="ghost" size="icon" className="size-7" aria-label="Löschen">
                        <Trash className="size-3.5" />
                      </SubmitButton>
                    </ActionForm>
                  ) : null}
                </div>
                <Multiline text={c.body} className="text-sm" />
              </div>
            </li>
          ))}
        </ul>
      )}

      <ActionForm action={addComment} resetOnSuccess className="flex items-end gap-2">
        <Hidden name="event_id" value={eventId} />
        <Textarea name="body" placeholder="Anmerkung schreiben …" rows={2} maxLength={2000} required className="min-h-11" />
        <SubmitButton size="icon" className="size-11" aria-label="Senden">
          <Send className="size-4" />
        </SubmitButton>
      </ActionForm>
    </div>
  );
}
