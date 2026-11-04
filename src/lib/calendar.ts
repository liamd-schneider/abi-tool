// Kalender ohne Google-API: .ics-Dateien, abonnierbarer Feed und "Zu Google Kalender"-Links.

export interface CalendarItem {
  uid: string;
  title: string;
  start: string;
  end?: string | null;
  description?: string | null;
  location?: string | null;
  url?: string | null;
}

const DEFAULT_DURATION_MS = 2 * 3_600_000;

function endOf(item: CalendarItem) {
  return item.end ?? new Date(new Date(item.start).getTime() + DEFAULT_DURATION_MS).toISOString();
}

/** 2026-12-05T13:00:00.000Z → 20261205T130000Z */
function icsDate(iso: string) {
  return new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function escapeText(text: string) {
  return text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** Zeilen nach RFC 5545 auf max. 75 Byte falten */
function fold(line: string) {
  const encoder = new TextEncoder();
  const out: string[] = [];
  let current = "";
  let bytes = 0;
  for (const char of line) {
    const size = encoder.encode(char).length;
    if (bytes + size > (out.length === 0 ? 75 : 74)) {
      out.push(current);
      current = "";
      bytes = 0;
    }
    current += char;
    bytes += size;
  }
  out.push(current);
  return out.join("\r\n ");
}

export function buildIcs(items: CalendarItem[], calendarName = "Abi-Tool") {
  const stamp = icsDate(new Date().toISOString());
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Abi-Tool//DE",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(calendarName)}`,
    "X-WR-TIMEZONE:Europe/Berlin",
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
    "X-PUBLISHED-TTL:PT1H",
  ];

  for (const item of items) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${item.uid}`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${icsDate(item.start)}`,
      `DTEND:${icsDate(endOf(item))}`,
      `SUMMARY:${escapeText(item.title)}`,
    );
    if (item.description) lines.push(`DESCRIPTION:${escapeText(item.description)}`);
    if (item.location) lines.push(`LOCATION:${escapeText(item.location)}`);
    if (item.url) lines.push(`URL:${item.url}`);
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}

/** Link, der Google Kalender mit vorausgefülltem Termin öffnet (keine API, keine Google Console nötig). */
export function googleCalendarUrl(item: CalendarItem) {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: item.title,
    dates: `${icsDate(item.start)}/${icsDate(endOf(item))}`,
    ctz: "Europe/Berlin",
  });
  if (item.description) params.set("details", item.description);
  if (item.location) params.set("location", item.location);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function icsResponse(ics: string, filename: string, inline = false) {
  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

export function fileSlug(text: string) {
  return (
    text
      .toLowerCase()
      .replace(/ä/g, "ae")
      .replace(/ö/g, "oe")
      .replace(/ü/g, "ue")
      .replace(/ß/g, "ss")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "termin"
  );
}
