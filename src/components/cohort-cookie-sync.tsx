"use client";

import { useEffect } from "react";

/** Einmalig im Hintergrund: Jahrgang auf diesem Gerät für den nächsten Login merken */
export function CohortCookieSync() {
  useEffect(() => {
    fetch("/api/me/cohort-cookie", { method: "POST", credentials: "same-origin" }).catch(() => {});
  }, []);
  return null;
}
