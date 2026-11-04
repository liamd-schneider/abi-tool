import type { ActionState } from "@/lib/types";

export function str(fd: FormData, key: string) {
  const value = fd.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export function optStr(fd: FormData, key: string) {
  const value = str(fd, key);
  return value === "" ? null : value;
}

export function int(fd: FormData, key: string, fallback: number) {
  const n = Number.parseInt(str(fd, key), 10);
  return Number.isFinite(n) ? n : fallback;
}

export function num(fd: FormData, key: string): number | null {
  const raw = str(fd, key).replace(",", ".");
  if (!raw) return null;
  const n = Number.parseFloat(raw);
  return Number.isFinite(n) ? n : null;
}

export function bool(fd: FormData, key: string) {
  const value = fd.get(key);
  return value === "on" || value === "true" || value === "1";
}

interface DbError {
  code?: string;
  message: string;
}

/** Datenbankfehler in verständliche Meldungen übersetzen */
export function dbError(error: DbError, messages: Partial<Record<string, string>> = {}): ActionState<never> {
  if (error.code && messages[error.code]) return { error: messages[error.code] };
  if (error.code === "23505") return { error: "Das gibt es schon." };
  if (error.code === "42501") return { error: "Dafür fehlt die Berechtigung." };
  if (error.code === "23514") return { error: "Die Eingaben sind ungültig (z. B. Ende vor Beginn)." };
  if (error.code === "P0001") return { error: error.message };
  console.error("DB-Fehler", error);
  return { error: `Fehler: ${error.message}` };
}
