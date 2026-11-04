// Benutzernamen im Format vorname.nachname

export function slugPart(text: string) {
  return text
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export interface ParsedName {
  first: string;
  last: string;
  full: string;
}

/**
 * Liest eine Zeile der Namensliste:
 *  - "Max Mustermann"        → Vorname "Max", Nachname "Mustermann"
 *  - "Anna Lena Schmidt"     → Vorname "Anna Lena", Nachname "Schmidt"
 *  - "Mustermann, Max"       → Nachname zuerst (mit Komma)
 *  - "Lisa; von Berg"        → mit Semikolon explizit getrennt
 */
export function parseNameLine(line: string): ParsedName | null {
  const clean = line.replace(/\s+/g, " ").trim();
  if (!clean) return null;

  let first: string;
  let last: string;

  if (clean.includes(";")) {
    [first, last] = clean.split(";").map((s) => s.trim());
  } else if (clean.includes(",")) {
    const [l, f] = clean.split(",").map((s) => s.trim());
    first = f;
    last = l;
  } else {
    const parts = clean.split(" ");
    if (parts.length < 2) return null;
    last = parts.pop()!;
    first = parts.join(" ");
  }

  if (!first || !last) return null;
  return { first, last, full: `${first} ${last}` };
}

export function makeUsername(first: string, last: string) {
  return `${slugPart(first)}.${slugPart(last)}`;
}

/** Eingabe im Login normalisieren: "Max Mustermann" oder "Max.Mustermann" → "max.mustermann" */
export function normalizeUsernameInput(input: string) {
  const trimmed = input.trim();
  if (trimmed.includes(" ")) {
    const parsed = parseNameLine(trimmed);
    if (parsed) return makeUsername(parsed.first, parsed.last);
  }
  return trimmed.toLowerCase();
}

const ALPHABET = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** Gut lesbares Startpasswort ohne verwechselbare Zeichen (0/O, 1/l/I) */
export function generatePassword(length = 10) {
  const bytes = new Uint32Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}
