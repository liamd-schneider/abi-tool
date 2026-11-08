import { TrendingDown, TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const number = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 1 });

export function formatCount(value: number) {
  if (Math.abs(value) >= 10_000) return `${number.format(value / 1000)} Tsd.`;
  return number.format(value);
}

/** Kennzahl-Kachel: Bezeichnung · Wert · optional Veränderung ggü. Vorperiode (mit Symbol, nie nur Farbe) */
export function StatTile({
  label,
  value,
  hint,
  delta,
  className,
}: {
  label: string;
  value: number | string;
  hint?: string;
  delta?: { value: number; period: string; goodWhenUp?: boolean };
  className?: string;
}) {
  const up = (delta?.value ?? 0) > 0;
  const good = delta ? (delta.goodWhenUp ?? true) === up : false;
  return (
    <Card className={className}>
      <CardContent className="flex flex-col gap-1 pt-4 sm:pt-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-2xl font-semibold tracking-tight tabular-nums">{typeof value === "number" ? formatCount(value) : value}</p>
        {delta && delta.value !== 0 ? (
          <p className={cn("inline-flex items-center gap-1 text-xs font-medium", good ? "text-success" : "text-destructive")}>
            {up ? <TrendingUp className="size-3.5" aria-hidden /> : <TrendingDown className="size-3.5" aria-hidden />}
            {up ? "+" : "−"}
            {formatCount(Math.abs(delta.value))} {delta.period}
          </p>
        ) : delta ? (
          <p className="text-xs text-muted-foreground">± 0 {delta.period}</p>
        ) : null}
        {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}
