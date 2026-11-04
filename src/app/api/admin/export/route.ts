import { getCurrentProfile } from "@/lib/auth";
import { formatDateTime, formatStamp, hoursBetween } from "@/lib/dates";
import { fetchAll, loadMemberStats } from "@/lib/stats";
import { createClient } from "@/lib/supabase/server";

const cell = (v: string | number | null | undefined) => {
  const s = v === null || v === undefined ? "" : String(v);
  return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const decimal = (n: number) => n.toLocaleString("de-DE", { maximumFractionDigits: 2 });

function csvResponse(rows: (string | number | null | undefined)[][], filename: string) {
  // Semikolon + BOM → öffnet sich in deutschem Excel direkt korrekt
  const body = "﻿" + rows.map((r) => r.map(cell).join(";")).join("\r\n");
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

interface SignupExport {
  created_at: string;
  attended: boolean | null;
  profiles: { full_name: string } | null;
  shifts: { title: string; starts_at: string; ends_at: string; events: { title: string } | null } | null;
}

export async function GET(request: Request) {
  const me = await getCurrentProfile();
  if (!me || me.role !== "admin") return new Response("Nur für Admins", { status: 403 });

  const type = new URL(request.url).searchParams.get("type") ?? "stats";
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);

  if (type === "signups") {
    const signups = await fetchAll<SignupExport>((from, to) =>
      supabase
        .from("shift_signups")
        .select("created_at, attended, profiles(full_name), shifts(title, starts_at, ends_at, events(title))")
        .order("created_at")
        .range(from, to),
    );
    const rows = signups
      .filter((s) => s.shifts)
      .sort((a, b) => a.shifts!.starts_at.localeCompare(b.shifts!.starts_at))
      .map((s) => [
        s.shifts!.events?.title,
        s.shifts!.title,
        formatDateTime(s.shifts!.starts_at),
        decimal(hoursBetween(s.shifts!.starts_at, s.shifts!.ends_at)),
        s.profiles?.full_name,
        formatStamp(s.created_at),
        s.attended === true ? "ja" : s.attended === false ? "nein" : "",
      ]);
    return csvResponse(
      [["Termin", "Schicht", "Beginn", "Stunden", "Name", "Eingetragen am", "Erschienen"], ...rows],
      `eintragungen-${today}.csv`,
    );
  }

  const stats = await loadMemberStats(supabase);
  const rows = stats.map((s) => [
    s.full_name,
    s.username,
    s.role === "admin" ? "Admin" : "Mitglied",
    s.shiftsDone,
    s.shiftsUpcoming,
    decimal(s.hoursDone),
    decimal(s.hoursPlanned),
    s.attended,
    s.missed,
    s.pledges,
    s.pledgeItems,
    s.lastActivity ? formatStamp(s.lastActivity) : "",
  ]);
  return csvResponse(
    [
      [
        "Name",
        "Benutzername",
        "Rolle",
        "Schichten geleistet",
        "Schichten geplant",
        "Stunden geleistet",
        "Stunden geplant",
        "Erschienen",
        "Nicht erschienen",
        "Spenden/Dienste",
        "Menge gesamt",
        "Zuletzt aktiv",
      ],
      ...rows,
    ],
    `statistik-${today}.csv`,
  );
}
