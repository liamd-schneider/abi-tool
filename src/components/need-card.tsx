import { Check } from "lucide-react";
import { ActionForm, Hidden, SubmitButton } from "@/components/action-form";
import { EventLink } from "@/components/event-bits";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { PersonChip } from "@/components/ui/misc";
import { Progress } from "@/components/ui/progress";
import { pledgeForNeed, withdrawPledge } from "@/actions/member";
import { NEED_KIND_LABEL, type NeedWithPledges } from "@/lib/types";
import { cn } from "@/lib/utils";

const CTA: Record<string, string> = {
  spende: "Ich bringe was mit",
  leihgabe: "Ich kann das leihen",
  material: "Ich besorge das",
};

export function NeedCard({
  need,
  meId,
  event,
  showEvent = false,
  closed = false,
}: {
  need: NeedWithPledges;
  meId: string;
  event: { id: string; title: string };
  showEvent?: boolean;
  closed?: boolean;
}) {
  const pledged = need.need_pledges.reduce((sum, p) => sum + p.quantity, 0);
  const remaining = Math.max(0, need.quantity_needed - pledged);
  const mine = need.need_pledges.find((p) => p.user_id === meId);
  const unit = need.unit ?? (need.quantity_needed === 1 ? "" : "Stück");
  const maxForMe = remaining + (mine?.quantity ?? 0);

  return (
    <div className={cn("flex flex-col gap-3 rounded-xl border border-border bg-card p-4", mine && "border-primary/50 ring-1 ring-primary/20")}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {showEvent ? <EventLink id={event.id} title={event.title} /> : null}
          <p className="font-semibold">{need.title}</p>
          {need.description ? <p className="mt-0.5 text-sm text-muted-foreground">{need.description}</p> : null}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <Badge variant="outline">{NEED_KIND_LABEL[need.kind]}</Badge>
          <span className="text-sm font-medium tabular-nums">
            {pledged}/{need.quantity_needed} {unit}
          </span>
        </div>
      </div>

      <Progress value={pledged} max={need.quantity_needed} />

      {need.need_pledges.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {need.need_pledges.map((p) => (
            <span key={p.id} title={p.note ?? undefined}>
              <PersonChip name={`${p.profiles?.full_name ?? "Unbekannt"}${need.quantity_needed > 1 ? ` · ${p.quantity}` : ""}`} />
            </span>
          ))}
        </div>
      ) : null}

      {closed ? null : mine ? (
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="default" className="py-1">
            <Check className="size-3.5" /> Du: {mine.quantity} {unit}
          </Badge>
          {need.quantity_needed > 1 ? (
            <ActionForm action={pledgeForNeed} className="flex items-center gap-1.5">
              <Hidden name="need_id" value={need.id} />
              <Hidden name="note" value={mine.note} />
              <Input
                name="quantity"
                type="number"
                min={1}
                max={maxForMe}
                defaultValue={mine.quantity}
                className="h-8 w-16"
                aria-label="Menge ändern"
              />
              <SubmitButton variant="outline" size="sm">
                Ändern
              </SubmitButton>
            </ActionForm>
          ) : null}
          <ActionForm action={withdrawPledge} confirm="Eintrag wirklich zurückziehen?">
            <Hidden name="need_id" value={need.id} />
            <SubmitButton variant="ghost" size="sm">
              Zurückziehen
            </SubmitButton>
          </ActionForm>
        </div>
      ) : remaining > 0 ? (
        <ActionForm action={pledgeForNeed} className="flex flex-wrap items-center gap-2">
          <Hidden name="need_id" value={need.id} />
          {need.quantity_needed > 1 ? (
            <Input
              name="quantity"
              type="number"
              min={1}
              max={remaining}
              defaultValue={1}
              className="h-8 w-16"
              aria-label="Menge"
            />
          ) : (
            <Hidden name="quantity" value={1} />
          )}
          <Input name="note" placeholder="Notiz (optional, z. B. Marmorkuchen)" className="h-8 min-w-40 flex-1" maxLength={200} />
          <SubmitButton size="sm">{CTA[need.kind]}</SubmitButton>
        </ActionForm>
      ) : (
        <span className="text-sm font-medium text-success">Alles abgedeckt – danke!</span>
      )}
    </div>
  );
}
