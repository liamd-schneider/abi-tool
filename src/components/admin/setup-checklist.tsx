import Link from "next/link";
import { ChevronRight, Circle, CircleCheck } from "lucide-react";
import { StartTourButton } from "@/components/admin/walkthrough";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

export interface ChecklistItem {
  label: string;
  hint: string;
  href: string;
  done: boolean;
}

/** Einrichtungs-Fortschritt – verschwindet, sobald alles erledigt ist */
export function SetupChecklist({ items }: { items: ChecklistItem[] }) {
  const done = items.filter((i) => i.done).length;
  if (done === items.length) return null;

  return (
    <Card className="border-primary/30">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle>
            Einrichtung: {done} von {items.length} erledigt
          </CardTitle>
          <StartTourButton>Anleitung starten</StartTourButton>
        </div>
        <Progress value={done} max={items.length} className="mt-2" />
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col">
          {items.map((item) => (
            <li key={item.label}>
              <Link href={item.href} className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-muted">
                {item.done ? (
                  <CircleCheck className="size-5 shrink-0 text-success" />
                ) : (
                  <Circle className="size-5 shrink-0 text-muted-foreground" />
                )}
                <div className="min-w-0 flex-1">
                  <p className={cn("text-sm font-medium", item.done && "text-muted-foreground line-through")}>{item.label}</p>
                  {!item.done ? <p className="text-xs text-muted-foreground">{item.hint}</p> : null}
                </div>
                {!item.done ? <ChevronRight className="size-4 shrink-0 text-muted-foreground" /> : null}
              </Link>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
