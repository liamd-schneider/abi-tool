import "server-only";
import { nowMs } from "@/lib/dates";
import { loadLastSignIns } from "@/lib/login-status";
import { fetchAll } from "@/lib/stats";
import { createAdminClient } from "@/lib/supabase/admin";

// Kennzahlen für den System-Admin (alle Schulen). Nur nach requirePlatformAdmin() aufrufen!

const DAY = 86_400_000;

export interface CohortStats {
  id: string;
  name: string;
  slug: string;
  join_code: string;
  active: boolean;
  pending: boolean;
  require_admin_2fa: boolean;
  created_at: string;
  schoolName: string;
  city: string | null;
  members: number;
  admins: number;
  everLoggedIn: number;
  active30: number;
  newMembers30: number;
  events: number;
  shifts: number;
  signups: number;
  pledges: number;
  polls: number;
  pushDevices: number;
  partnerClicks30: number;
  lastActivity: string | null;
}

export interface WeekBucket {
  start: string;
  end: string;
  value: number;
}

interface ProfileRow {
  id: string;
  cohort_id: string;
  role: string;
  created_at: string;
  full_name: string;
  username: string;
}

function latest(a: string | null, b: string | null | undefined) {
  if (!b) return a;
  return !a || b > a ? b : a;
}

export async function loadPlatformStats() {
  const admin = createAdminClient();
  const now = nowMs();
  const since30 = new Date(now - 30 * DAY).toISOString();

  const [cohortRes, schoolCount, profiles, events, shifts, signups, pledges, polls, push, clicks, lastSignIns] = await Promise.all([
    admin
      .from("cohorts")
      .select("id, name, slug, join_code, active, pending, require_admin_2fa, created_at, schools(name, city)")
      .order("created_at", { ascending: false }),
    admin.from("schools").select("id", { count: "exact", head: true }),
    fetchAll<ProfileRow>((f, t) => admin.from("profiles").select("id, cohort_id, role, created_at, full_name, username").range(f, t)),
    fetchAll<{ cohort_id: string; created_at: string }>((f, t) => admin.from("events").select("cohort_id, created_at").range(f, t)),
    fetchAll<{ events: { cohort_id: string } | null }>((f, t) => admin.from("shifts").select("events(cohort_id)").range(f, t)),
    fetchAll<{ created_at: string; shifts: { events: { cohort_id: string } | null } | null }>((f, t) =>
      admin.from("shift_signups").select("created_at, shifts(events(cohort_id))").range(f, t),
    ),
    fetchAll<{ created_at: string; event_needs: { events: { cohort_id: string } | null } | null }>((f, t) =>
      admin.from("need_pledges").select("created_at, event_needs(events(cohort_id))").range(f, t),
    ),
    fetchAll<{ cohort_id: string }>((f, t) => admin.from("polls").select("cohort_id").range(f, t)),
    fetchAll<{ user_id: string }>((f, t) => admin.from("push_subscriptions").select("user_id").range(f, t)),
    fetchAll<{ cohort_id: string | null }>((f, t) => admin.from("partner_clicks").select("cohort_id").gte("created_at", since30).range(f, t)),
    loadLastSignIns(),
  ]);

  const byCohort = new Map<string, CohortStats>();
  for (const c of (cohortRes.data ?? []) as unknown as (Omit<CohortStats, "schoolName" | "city"> & {
    schools: { name: string; city: string | null } | null;
  })[]) {
    byCohort.set(c.id, {
      id: c.id,
      name: c.name,
      slug: c.slug,
      join_code: c.join_code,
      active: c.active,
      pending: c.pending,
      require_admin_2fa: c.require_admin_2fa,
      created_at: c.created_at,
      schoolName: c.schools?.name ?? "?",
      city: c.schools?.city ?? null,
      members: 0,
      admins: 0,
      everLoggedIn: 0,
      active30: 0,
      newMembers30: 0,
      events: 0,
      shifts: 0,
      signups: 0,
      pledges: 0,
      polls: 0,
      pushDevices: 0,
      partnerClicks30: 0,
      lastActivity: null,
    });
  }

  const cohortOfUser = new Map<string, string>();
  for (const p of profiles) {
    cohortOfUser.set(p.id, p.cohort_id);
    const s = byCohort.get(p.cohort_id);
    if (!s) continue;
    s.members++;
    if (p.role === "admin") s.admins++;
    if (p.created_at >= since30) s.newMembers30++;
    const login = lastSignIns.get(p.id) ?? null;
    if (login) {
      s.everLoggedIn++;
      if (login >= since30) s.active30++;
      s.lastActivity = latest(s.lastActivity, login);
    }
  }
  for (const e of events) {
    const s = byCohort.get(e.cohort_id);
    if (s) {
      s.events++;
      s.lastActivity = latest(s.lastActivity, e.created_at);
    }
  }
  for (const sh of shifts) {
    const s = sh.events ? byCohort.get(sh.events.cohort_id) : undefined;
    if (s) s.shifts++;
  }
  for (const x of signups) {
    const s = x.shifts?.events ? byCohort.get(x.shifts.events.cohort_id) : undefined;
    if (s) {
      s.signups++;
      s.lastActivity = latest(s.lastActivity, x.created_at);
    }
  }
  for (const x of pledges) {
    const s = x.event_needs?.events ? byCohort.get(x.event_needs.events.cohort_id) : undefined;
    if (s) {
      s.pledges++;
      s.lastActivity = latest(s.lastActivity, x.created_at);
    }
  }
  for (const p of polls) {
    const s = byCohort.get(p.cohort_id);
    if (s) s.polls++;
  }
  for (const d of push) {
    const s = byCohort.get(cohortOfUser.get(d.user_id) ?? "");
    if (s) s.pushDevices++;
  }
  for (const c of clicks) {
    const s = c.cohort_id ? byCohort.get(c.cohort_id) : undefined;
    if (s) s.partnerClicks30++;
  }

  const cohorts = [...byCohort.values()].sort((a, b) => Number(b.pending) - Number(a.pending) || b.members - a.members);

  // Neue Accounts pro Woche (letzte 12 Wochen, jüngste rechts)
  const weeks: WeekBucket[] = Array.from({ length: 12 }, (_, i) => {
    const end = now - (11 - i) * 7 * DAY;
    return { start: new Date(end - 7 * DAY).toISOString(), end: new Date(end).toISOString(), value: 0 };
  });
  for (const p of profiles) {
    const age = now - new Date(p.created_at).getTime();
    const idx = 11 - Math.floor(age / (7 * DAY));
    if (idx >= 0 && idx < 12) weeks[idx].value++;
  }

  const since60 = new Date(now - 60 * DAY).toISOString();
  const totals = {
    schools: schoolCount.count ?? 0,
    cohorts: cohorts.length,
    cohortsActive: cohorts.filter((c) => c.active && !c.pending).length,
    cohortsPending: cohorts.filter((c) => c.pending).length,
    cohortsLocked: cohorts.filter((c) => !c.active).length,
    members: profiles.length,
    active30: cohorts.reduce((s, c) => s + c.active30, 0),
    newMembers30: profiles.filter((p) => p.created_at >= since30).length,
    newMembersPrev30: profiles.filter((p) => p.created_at >= since60 && p.created_at < since30).length,
    newCohorts30: cohorts.filter((c) => c.created_at >= since30).length,
    partnerClicks30: clicks.length,
    signups: signups.length,
    pledges: pledges.length,
  };

  return { cohorts, totals, weeks, profiles, lastSignIns };
}
