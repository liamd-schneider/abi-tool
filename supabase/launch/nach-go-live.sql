-- =====================================================================
--  ERST AUSFÜHREN, WENN DIE MEHRSCHULEN-APP LIVE IST!
--  (Die bisherige App liest calendar_token beim Login und legt Profile ohne Jahrgang an –
--   mit dieser Datei würde sie nicht mehr funktionieren.)
--
--  Zum Go-live: Datei nach supabase/migrations/<zeitstempel>_nach_go_live.sql kopieren
--  und mit `npm run db:push` einspielen – direkt nachdem die neue Version deployt ist.
-- =====================================================================

-- Kalender-Schlüssel ist geheim, nur bestimmte Spalten änderbar
-- (vorher konnte jedes Mitglied die Kalender-Links der anderen auslesen)
revoke select, insert, update, delete on public.profiles from authenticated;
grant select (id, username, full_name, role, cohort_id, created_at, admin_tour_done_at) on public.profiles to authenticated;
grant update (full_name, role, admin_tour_done_at) on public.profiles to authenticated;

-- Übergangs-Standardwert entfernen: neue Profile brauchen immer einen ausdrücklichen Jahrgang
alter table public.profiles alter column cohort_id drop default;
