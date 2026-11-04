"use client";

import { useOptimistic, useTransition } from "react";
import { toast } from "sonner";
import { Check } from "lucide-react";
import { Avatar } from "@/components/ui/misc";
import { castVote } from "@/actions/member";
import { cn } from "@/lib/utils";

export interface PollVoterOption {
  id: string;
  label: string;
  votes: number;
  voters: string[]; // Namen (leer bei anonymen Umfragen)
}

/** Abstimmen wie bei WhatsApp: Antippen = abstimmen, nochmal antippen = zurücknehmen. */
export function PollVoter({
  pollId,
  options,
  myVotes,
  totalVoters,
  allowMultiple,
  closed,
  anonymous,
}: {
  pollId: string;
  options: PollVoterOption[];
  myVotes: string[];
  totalVoters: number;
  allowMultiple: boolean;
  closed: boolean;
  anonymous: boolean;
}) {
  const [selected, setSelected] = useOptimistic(myVotes);
  const [pending, startTransition] = useTransition();

  function toggle(optionId: string) {
    if (closed) return;
    const isSelected = selected.includes(optionId);
    const next = allowMultiple
      ? isSelected
        ? selected.filter((id) => id !== optionId)
        : [...selected, optionId]
      : isSelected
        ? []
        : [optionId];

    startTransition(async () => {
      setSelected(next);
      const result = await castVote(pollId, next);
      if (result?.error) toast.error(result.error);
    });
  }

  // Zählungen optimistisch an die aktuelle Auswahl anpassen
  const voterDelta = (selected.length > 0 ? 1 : 0) - (myVotes.length > 0 ? 1 : 0);
  const voters = Math.max(0, totalVoters + voterDelta);

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-muted-foreground">
        {closed ? "Abstimmung beendet" : allowMultiple ? "Mehrere Antworten möglich" : "Eine Antwort möglich"}
        {anonymous ? " · anonym" : ""}
      </p>
      {options.map((o) => {
        const isSelected = selected.includes(o.id);
        const count = Math.max(0, o.votes - (myVotes.includes(o.id) ? 1 : 0) + (isSelected ? 1 : 0));
        const pct = voters > 0 ? Math.round((count / voters) * 100) : 0;
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => toggle(o.id)}
            disabled={closed}
            aria-pressed={isSelected}
            className={cn(
              "relative w-full overflow-hidden rounded-xl border border-border bg-card p-3 text-left transition-colors",
              !closed && "hover:border-primary/50",
              isSelected && "border-primary",
              pending && "cursor-wait",
            )}
          >
            <div
              className={cn("absolute inset-y-0 left-0 transition-all duration-300", isSelected ? "bg-primary/15" : "bg-muted")}
              style={{ width: `${pct}%` }}
              aria-hidden
            />
            <div className="relative flex items-center gap-3">
              <span
                className={cn(
                  "flex size-5 shrink-0 items-center justify-center border-2 border-input",
                  allowMultiple ? "rounded-md" : "rounded-full",
                  isSelected && "border-primary bg-primary text-primary-foreground",
                )}
              >
                {isSelected ? <Check className="size-3.5" strokeWidth={3} /> : null}
              </span>
              <span className="min-w-0 flex-1 font-medium break-words">{o.label}</span>
              <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
                {count} <span className="text-xs">({pct}%)</span>
              </span>
            </div>
            {!anonymous && o.voters.length > 0 ? (
              <div className="relative mt-2 flex flex-wrap items-center gap-1 pl-8">
                {o.voters.slice(0, 12).map((name, i) => (
                  <Avatar key={`${name}-${i}`} name={name} className="size-6 text-[9px] ring-2 ring-card" />
                ))}
                {o.voters.length > 12 ? <span className="text-xs text-muted-foreground">+{o.voters.length - 12}</span> : null}
              </div>
            ) : null}
          </button>
        );
      })}
      <p className="text-sm text-muted-foreground">
        {voters === 1 ? "1 Person hat abgestimmt" : `${voters} Personen haben abgestimmt`}
      </p>
    </div>
  );
}
