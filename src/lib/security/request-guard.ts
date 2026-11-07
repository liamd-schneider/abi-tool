import "server-only";
import { timingSafeEqual } from "node:crypto";

/**
 * CSRF-Schutz für eigene POST/DELETE-Routen: Anfragen müssen von der eigenen Seite kommen.
 * (Server Actions prüfen das in Next.js bereits selbst.)
 */
export function isSameOrigin(request: Request) {
  const site = request.headers.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none") return false;
  const origin = request.headers.get("origin");
  if (!origin) return site === "same-origin"; // ohne Origin nur, wenn der Browser "same-origin" bestätigt
  try {
    const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

/** Geheimnisse in konstanter Zeit vergleichen (verhindert Timing-Angriffe) */
export function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
