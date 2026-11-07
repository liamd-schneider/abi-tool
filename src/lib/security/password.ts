import "server-only";
import { createHash } from "node:crypto";

export const MIN_PASSWORD_LENGTH = 10;

// Häufige deutsche/englische Passwörter und Schul-Klassiker
const COMMON = [
  "passwort",
  "password",
  "123456",
  "qwertz",
  "qwerty",
  "asdfgh",
  "hallo",
  "abitur",
  "abi20",
  "schule",
  "gymnasium",
  "iloveyou",
  "ichliebedich",
  "geheim",
  "sommer",
  "winter",
  "fussball",
  "fußball",
  "letmein",
  "willkommen",
  "welcome",
];

/**
 * Prüft ein neues Passwort. Gibt eine Fehlermeldung zurück oder null, wenn es in Ordnung ist.
 * `personal`: Name, Benutzername, Schule … – darf nicht im Passwort vorkommen.
 */
export async function checkNewPassword(password: string, personal: string[] = []): Promise<string | null> {
  if (password.length < MIN_PASSWORD_LENGTH) return `Das Passwort muss mindestens ${MIN_PASSWORD_LENGTH} Zeichen haben.`;
  if (password.length > 128) return "Das Passwort darf höchstens 128 Zeichen haben.";

  const lower = password.toLowerCase();
  if (new Set(lower).size < 4) return "Das Passwort ist zu einfach (zu wenige verschiedene Zeichen).";
  if (/^(0123456789|1234567890|abcdefghij)/.test(lower)) return "Das Passwort ist zu leicht zu erraten.";
  // Kurzes Passwort, das im Wesentlichen nur aus einem Klassiker besteht
  if (COMMON.some((word) => lower.includes(word) && lower.length < word.length + 6)) {
    return "Das Passwort ist zu leicht zu erraten.";
  }
  for (const part of personal.flatMap((p) => p.toLowerCase().split(/[\s.\-_,]+/))) {
    if (part.length >= 4 && lower.includes(part)) return "Das Passwort darf deinen Namen oder eure Schule nicht enthalten.";
  }
  if (await isPwnedPassword(password)) {
    return "Dieses Passwort ist schon in Datenlecks im Internet aufgetaucht – bitte wähle ein anderes.";
  }
  return null;
}

/**
 * Have I Been Pwned (k-Anonymität): Es werden nur die ersten 5 Zeichen des SHA-1-Hashes gesendet,
 * nie das Passwort. Bei Netzwerkproblemen wird nicht blockiert.
 */
async function isPwnedPassword(password: string): Promise<boolean> {
  const hash = createHash("sha1").update(password).digest("hex").toUpperCase();
  const prefix = hash.slice(0, 5);
  const suffix = hash.slice(5);
  try {
    const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { "Add-Padding": "true", "User-Agent": "abi-tool-password-check" },
      signal: AbortSignal.timeout(2500),
      cache: "no-store",
    });
    if (!res.ok) return false;
    const body = await res.text();
    return body.split("\n").some((line) => {
      const [s, count] = line.trim().split(":");
      return s === suffix && Number(count) > 0;
    });
  } catch {
    return false;
  }
}
