"use client";

import { useState } from "react";
import { Table2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface Bar {
  start: string;
  end: string;
  value: number;
}

const short = new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", timeZone: "Europe/Berlin" });
const range = (b: Bar) => `${short.format(new Date(b.start))}–${short.format(new Date(new Date(b.end).getTime() - 1))}`;

/** Ein-Serien-Balkendiagramm pro Woche: Tooltip pro Balken (Maus & Tastatur), Tabellenansicht für Screenreader/Export */
export function WeeklyBars({ title, data, unit }: { title: string; data: Bar[]; unit: [singular: string, plural: string] }) {
  const [active, setActive] = useState<number | null>(null);
  const [showTable, setShowTable] = useState(false);
  const max = Math.max(1, ...data.map((d) => d.value));
  const total = data.reduce((s, d) => s + d.value, 0);
  const label = (v: number) => `${v} ${v === 1 ? unit[0] : unit[1]}`;

  return (
    <figure className="flex flex-col gap-3" aria-label={`${title}: insgesamt ${label(total)} in ${data.length} Wochen`}>
      <div className="flex items-baseline justify-between gap-2">
        <figcaption className="text-sm font-semibold">{title}</figcaption>
        <button
          type="button"
          onClick={() => setShowTable((s) => !s)}
          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          aria-pressed={showTable}
        >
          <Table2 className="size-3.5" /> {showTable ? "Diagramm" : "Tabelle"}
        </button>
      </div>

      {showTable ? (
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-muted-foreground">
            <tr>
              <th className="py-1 font-medium">Woche</th>
              <th className="py-1 text-right font-medium">{unit[1]}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {data.map((d) => (
              <tr key={d.start}>
                <td className="py-1 tabular-nums">{range(d)}</td>
                <td className="py-1 text-right tabular-nums">{d.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="flex gap-2">
          {/* zurückhaltende Achse: nur Maximum und Null */}
          <div className="flex h-40 flex-col justify-between py-px text-right text-[10px] text-muted-foreground tabular-nums">
            <span>{max}</span>
            <span>0</span>
          </div>
          <div className="relative min-w-0 flex-1">
            <div className="pointer-events-none absolute inset-x-0 top-0 border-t border-dashed border-border" aria-hidden />
            <div className="flex h-40 items-end border-b border-border">
              {data.map((d, i) => (
                <button
                  key={d.start}
                  type="button"
                  className="group relative flex h-full flex-1 items-end px-px focus-visible:outline-none"
                  onPointerEnter={() => setActive(i)}
                  onPointerLeave={() => setActive((a) => (a === i ? null : a))}
                  onFocus={() => setActive(i)}
                  onBlur={() => setActive((a) => (a === i ? null : a))}
                  aria-label={`${range(d)}: ${label(d.value)}`}
                >
                  {d.value > 0 ? (
                    <span
                      className={cn(
                        "w-full rounded-t-[4px] bg-[var(--chart-1)] transition-opacity",
                        active === i ? "opacity-75" : "opacity-100",
                        "group-focus-visible:ring-2 group-focus-visible:ring-ring",
                      )}
                      style={{ height: `${(d.value / max) * 100}%` }}
                    />
                  ) : null}
                  {active === i ? (
                    <span
                      role="tooltip"
                      className={cn(
                        "pointer-events-none absolute bottom-full z-10 mb-1 rounded-md border border-border bg-card px-2 py-1 text-xs whitespace-nowrap shadow-md",
                        i < 3 ? "left-0" : i > data.length - 4 ? "right-0" : "left-1/2 -translate-x-1/2",
                      )}
                    >
                      <span className="block text-muted-foreground">{range(d)}</span>
                      <span className="font-semibold tabular-nums">{label(d.value)}</span>
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
            <div className="mt-1 flex text-[10px] text-muted-foreground tabular-nums">
              {data.map((d, i) => (
                <span key={d.start} className="flex-1 text-center">
                  {i % 2 === 1 ? short.format(new Date(d.start)) : ""}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </figure>
  );
}
