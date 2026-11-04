// Alle Zeiten liegen in der DB als UTC (timestamptz) und werden immer in Europe/Berlin angezeigt –
// unabhängig davon, in welcher Zeitzone der Server (Vercel = UTC) läuft.

export const TIME_ZONE = "Europe/Berlin";

const fmt = (options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("de-DE", { timeZone: TIME_ZONE, ...options });

const weekdayDate = fmt({ weekday: "short", day: "2-digit", month: "2-digit", year: "numeric" });
const weekdayDateShort = fmt({ weekday: "short", day: "2-digit", month: "2-digit" });
const timeOnly = fmt({ hour: "2-digit", minute: "2-digit" });
const dayKeyFmt = fmt({ year: "numeric", month: "2-digit", day: "2-digit" });
const longDate = fmt({ weekday: "long", day: "numeric", month: "long", year: "numeric" });
const dateTimeShort = fmt({ day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

const dayNum = fmt({ day: "2-digit" });
const monthShort = fmt({ month: "short" });
const weekdayShort = fmt({ weekday: "short" });

/** Für Datums-Kacheln: { day: "05", month: "Dez.", weekday: "Sa." } */
export function dateParts(iso: string) {
  const d = new Date(iso);
  return { day: dayNum.format(d), month: monthShort.format(d), weekday: weekdayShort.format(d) };
}

export const nowMs = () => Date.now();
export const nowIso = () => new Date().toISOString();

export function formatDate(iso: string) {
  return weekdayDate.format(new Date(iso));
}
export function formatDateShort(iso: string) {
  return weekdayDateShort.format(new Date(iso));
}
export function formatDateLong(iso: string) {
  return longDate.format(new Date(iso));
}
export function formatTime(iso: string) {
  return timeOnly.format(new Date(iso));
}
export function formatDateTime(iso: string) {
  return `${formatDate(iso)}, ${formatTime(iso)} Uhr`;
}
export function formatStamp(iso: string) {
  return dateTimeShort.format(new Date(iso));
}

export function sameDay(a: string, b: string) {
  return dayKeyFmt.format(new Date(a)) === dayKeyFmt.format(new Date(b));
}

/** "Sa., 05.12.2026, 14:00–18:00 Uhr" bzw. mehrtägig mit beiden Daten */
export function formatRange(start: string, end: string | null) {
  if (!end) return formatDateTime(start);
  if (sameDay(start, end)) return `${formatDate(start)}, ${formatTime(start)}–${formatTime(end)} Uhr`;
  return `${formatDate(start)}, ${formatTime(start)} – ${formatDate(end)}, ${formatTime(end)} Uhr`;
}

export function formatTimeRange(start: string, end: string) {
  return `${formatTime(start)}–${formatTime(end)}`;
}

export function hoursBetween(start: string, end: string) {
  return Math.max(0, (new Date(end).getTime() - new Date(start).getTime()) / 3_600_000);
}

export function formatHours(h: number) {
  return `${h.toLocaleString("de-DE", { maximumFractionDigits: 1 })} h`;
}

/** "heute", "morgen", "in 3 Tagen", "vor 2 Tagen" – nach Kalendertagen in Berlin */
export function relativeDay(iso: string, now = nowMs()) {
  const key = (d: Date) => {
    const [day, month, year] = dayKeyFmt.format(d).split(".").map(Number);
    return Date.UTC(year, month - 1, day);
  };
  const diff = Math.round((key(new Date(iso)) - key(new Date(now))) / 86_400_000);
  if (diff === 0) return "heute";
  if (diff === 1) return "morgen";
  if (diff === -1) return "gestern";
  if (diff > 1) return `in ${diff} Tagen`;
  return `vor ${-diff} Tagen`;
}

function offsetMinutes(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return Math.round((asUtc - date.getTime()) / 60_000);
}

/** "2026-12-05T14:00" (Berliner Ortszeit aus <input type="datetime-local">) → ISO-UTC */
export function fromLocalInput(local: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(local);
  if (!match) throw new Error(`Ungültige Zeitangabe: ${local}`);
  const [, y, mo, d, h, mi] = match.map(Number);
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  let ts = guess - offsetMinutes(new Date(guess)) * 60_000;
  const corrected = guess - offsetMinutes(new Date(ts)) * 60_000; // Sommer-/Winterzeit-Grenze
  if (corrected !== ts) ts = corrected;
  return new Date(ts).toISOString();
}

/** ISO-UTC → "2026-12-05T14:00" in Berliner Ortszeit (für defaultValue von datetime-local) */
export function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(new Date(iso));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

export function addHours(iso: string, hours: number) {
  return new Date(new Date(iso).getTime() + hours * 3_600_000).toISOString();
}

/** Ist ein Termin noch nicht vorbei? Ohne Ende gilt er bis 6 h nach Beginn. */
export function isUpcoming(start: string, end: string | null, now = nowMs()) {
  const until = end ? new Date(end).getTime() : new Date(start).getTime() + 6 * 3_600_000;
  return until >= now;
}
