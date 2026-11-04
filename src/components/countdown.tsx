"use client";

import { useSyncExternalStore } from "react";

function subscribe(callback: () => void) {
  const id = setInterval(callback, 1000);
  return () => clearInterval(id);
}
const getSecond = () => Math.floor(Date.now() / 1000);
const getServerSecond = () => 0;

/** Live-Countdown bis zu einem Zeitpunkt ("2 T 04:12:09") */
export function Countdown({ target, compact = false }: { target: string; compact?: boolean }) {
  const second = useSyncExternalStore(subscribe, getSecond, getServerSecond);
  if (second === 0) return <span className="tabular-nums opacity-60">–</span>;

  const diff = Math.floor(new Date(target).getTime() / 1000) - second;
  if (diff <= 0) return <span className="font-semibold">jetzt</span>;

  const days = Math.floor(diff / 86_400);
  const hours = Math.floor((diff % 86_400) / 3_600);
  const minutes = Math.floor((diff % 3_600) / 60);
  const seconds = diff % 60;
  const pad = (n: number) => String(n).padStart(2, "0");

  if (compact) {
    if (days > 0) return <span className="tabular-nums">{days} T {hours} h</span>;
    if (hours > 0) return <span className="tabular-nums">{hours} h {minutes} min</span>;
    return <span className="tabular-nums">{minutes} min {pad(seconds)} s</span>;
  }

  return (
    <span className="tabular-nums">
      {days > 0 ? `${days} ${days === 1 ? "Tag" : "Tage"} ` : ""}
      {pad(hours)}:{pad(minutes)}:{pad(seconds)}
    </span>
  );
}
