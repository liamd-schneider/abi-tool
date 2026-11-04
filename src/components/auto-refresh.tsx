"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Lädt die Seitendaten regelmäßig neu (z. B. für Live-Ergebnisse bei Abstimmungen). */
export function AutoRefresh({ seconds = 20 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, seconds * 1000);
    return () => clearInterval(id);
  }, [router, seconds]);
  return null;
}
