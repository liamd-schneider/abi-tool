import { Check, Plus } from "lucide-react";
import { ActionForm, Hidden, SubmitButton } from "@/components/action-form";
import { CalendarButtons } from "@/components/calendar-buttons";
import { EventLink } from "@/components/event-bits";
import { Badge } from "@/components/ui/badge";
import { PersonChip } from "@/components/ui/misc";
import { Progress } from "@/components/ui/progress";
import { cancelShift, signUpForShift } from "@/actions/member";
import { formatDateShort, formatTimeRange, nowMs } from "@/lib/dates";
import type { ShiftWithSignups } from "@/lib/types";
import { cn } from "@/lib/utils";

export function ShiftCard({
  shift,
  meId,
  event,
  showEvent = false,
}: {
  shift: ShiftWithSignups;
  meId: string;
  event: { id: string; title: string; location?: string | null };
  showEvent?: boolean;
}) {
  const signups = [...shift.shift_signups].sort((a, b) => a.created_at.localeCompare(b.created_at));
  const taken = signups.length;
  const free = shift.capacity - taken;
  const mine = signups.some((s) => s.user_id === meId);
  const past = new Date(shift.ends_at).getTime() < nowMs();

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-xl border border-border bg-card p-4",
        mine && "border-primary/50 ring-1 ring-primary/20",
        past && "opacity-70",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {showEvent ? <EventLink id={event.id} title={event.title} /> : null}
          <p className="font-semibold">{shift.title}</p>
          <p className="text-sm text-muted-foreground">
            {formatDateShort(shift.starts_at)} · {formatTimeRange(shift.starts_at, shift.ends_at)} Uhr
          </p>
          {shift.description ? <p className="mt-1 text-sm">{shift.description}</p> : null}
        </div>
        <Badge variant={free <= 0 ? "success" : free === 1 ? "warning" : "muted"} className="tabular-nums">
          {taken}/{shift.capacity}
        </Badge>
      </div>

      <Progress value={taken} max={shift.capacity} />

      {signups.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {signups.map((s) => (
            <PersonChip key={s.user_id} name={s.profiles?.full_name ?? "Unbekannt"} />
          ))}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        {past ? (
          <span className="text-sm text-muted-foreground">Schicht ist vorbei</span>
        ) : mine ? (
          <>
            <Badge variant="default" className="py-1">
              <Check className="size-3.5" /> Du bist dabei
            </Badge>
            <ActionForm action={cancelShift} confirm={`Wirklich aus „${shift.title}“ austragen?`}>
              <Hidden name="shift_id" value={shift.id} />
              <SubmitButton variant="ghost" size="sm">
                Austragen
              </SubmitButton>
            </ActionForm>
          </>
        ) : free <= 0 ? (
          <span className="text-sm font-medium text-success">Voll besetzt – danke!</span>
        ) : (
          <ActionForm action={signUpForShift}>
            <Hidden name="shift_id" value={shift.id} />
            <SubmitButton size="sm">
              <Plus className="size-4" /> Eintragen
            </SubmitButton>
          </ActionForm>
        )}
        {free > 0 && !past && !mine ? (
          <span className="text-xs text-muted-foreground">
            {free === 1 ? "noch 1 Platz frei" : `noch ${free} Plätze frei`}
          </span>
        ) : null}
      </div>

      {mine && !past ? (
        <CalendarButtons
          compact
          icsHref={`/api/ics/shift/${shift.id}`}
          item={{
            uid: `shift-${shift.id}@abi-tool`,
            title: `Schicht: ${shift.title} – ${event.title}`,
            start: shift.starts_at,
            end: shift.ends_at,
            location: event.location ?? null,
            description: shift.description,
          }}
        />
      ) : null}
    </div>
  );
}
