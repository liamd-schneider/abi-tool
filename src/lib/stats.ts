import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { hoursBetween, nowMs } from "@/lib/dates";
import type { Role } from "@/lib/types";

/** Lädt alle Zeilen seitenweise (Supabase liefert max. 1000 pro Anfrage). */
export async function fetchAll<T>(
  build: (from: number, to: number) => PromiseLike<{ data: unknown; error: { message: string } | null }>,
): Promise<T[]> {
  const pageSize = 1000;
  const rows: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await build(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    const page = (data ?? []) as T[];
    rows.push(...page);
    if (page.length < pageSize) break;
  }
  return rows;
}

export interface MemberStats {
  id: string;
  full_name: string;
  username: string;
  role: Role;
  shiftsTotal: number;
  shiftsDone: number;
  shiftsUpcoming: number;
  attended: number;
  missed: number;
  hoursDone: number;
  hoursPlanned: number;
  pledges: number;
  pledgeItems: number;
  delivered: number;
  lastActivity: string | null;
}

interface SignupStat {
  user_id: string;
  created_at: string;
  attended: boolean | null;
  shifts: { starts_at: string; ends_at: string } | null;
}

interface PledgeStat {
  user_id: string;
  quantity: number;
  delivered: boolean | null;
  created_at: string;
}

export async function loadMemberStats(supabase: SupabaseClient): Promise<MemberStats[]> {
  const [profiles, signups, pledges] = await Promise.all([
    fetchAll<{ id: string; full_name: string; username: string; role: Role }>((from, to) =>
      supabase.from("profiles").select("id, full_name, username, role").order("full_name").range(from, to),
    ),
    fetchAll<SignupStat>((from, to) =>
      supabase
        .from("shift_signups")
        .select("user_id, created_at, attended, shifts(starts_at, ends_at)")
        .order("created_at")
        .range(from, to),
    ),
    fetchAll<PledgeStat>((from, to) =>
      supabase.from("need_pledges").select("user_id, quantity, delivered, created_at").order("created_at").range(from, to),
    ),
  ]);

  const now = nowMs();
  const stats = new Map<string, MemberStats>(
    profiles.map((p) => [
      p.id,
      {
        ...p,
        shiftsTotal: 0,
        shiftsDone: 0,
        shiftsUpcoming: 0,
        attended: 0,
        missed: 0,
        hoursDone: 0,
        hoursPlanned: 0,
        pledges: 0,
        pledgeItems: 0,
        delivered: 0,
        lastActivity: null,
      },
    ]),
  );

  const touch = (s: MemberStats, at: string) => {
    if (!s.lastActivity || at > s.lastActivity) s.lastActivity = at;
  };

  for (const signup of signups) {
    const s = stats.get(signup.user_id);
    if (!s || !signup.shifts) continue;
    const hours = hoursBetween(signup.shifts.starts_at, signup.shifts.ends_at);
    s.shiftsTotal++;
    touch(s, signup.created_at);
    if (signup.attended === true) s.attended++;
    if (signup.attended === false) s.missed++;
    if (new Date(signup.shifts.ends_at).getTime() < now) {
      // Vergangene Schicht zählt als geleistet, außer sie wurde als "nicht erschienen" markiert
      if (signup.attended !== false) {
        s.shiftsDone++;
        s.hoursDone += hours;
      }
    } else {
      s.shiftsUpcoming++;
      s.hoursPlanned += hours;
    }
  }

  for (const pledge of pledges) {
    const s = stats.get(pledge.user_id);
    if (!s) continue;
    s.pledges++;
    s.pledgeItems += pledge.quantity;
    if (pledge.delivered) s.delivered++;
    touch(s, pledge.created_at);
  }

  return [...stats.values()];
}
