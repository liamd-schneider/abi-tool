import { cn } from "@/lib/utils";

export function Progress({ value, max, className }: { value: number; max: number; className?: string }) {
  const ratio = max > 0 ? Math.min(1, value / max) : 0;
  const color = ratio >= 1 ? "bg-success" : ratio >= 0.5 ? "bg-primary" : "bg-warning";
  return (
    <div
      className={cn("h-1.5 w-full overflow-hidden rounded-full bg-muted", className)}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
    >
      <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${ratio * 100}%` }} />
    </div>
  );
}
