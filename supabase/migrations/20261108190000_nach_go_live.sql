-- Go-live der Mehrschulen-Version am 2026-11-08 (vorher: supabase/launch/nach-go-live.sql)
-- Kalender-Schlüssel ist geheim, nur bestimmte Spalten änderbar
-- (vorher konnte jedes Mitglied die Kalender-Links der anderen auslesen)
revoke select, insert, update, delete on public.profiles from authenticated;
grant select (id, username, full_name, role, cohort_id, created_at, admin_tour_done_at) on public.profiles to authenticated;
grant update (full_name, role, admin_tour_done_at) on public.profiles to authenticated;

-- Übergangs-Standardwert entfernen: neue Profile brauchen immer einen ausdrücklichen Jahrgang
alter table public.profiles alter column cohort_id drop default;
