-- =====================================================================
--  Sicherheits-Härtung
--  Rate-Limits, Audit-Protokoll, versteckte Kalender-Schlüssel, Spalten-Rechte,
--  Schutz des letzten Admins, 2FA-Pflicht, Freischaltung neuer Jahrgänge,
--  Sitzungen beenden, Datenbereinigung, keine Rechte für anon auf künftige Objekte
-- =====================================================================

-- ---------------------------------------------------------------------
--  Rate-Limits (Login, Registrierung, Partner-Klicks …) – nur serverseitig nutzbar
-- ---------------------------------------------------------------------
create table public.rate_limits (
  id         bigint generated always as identity primary key,
  key        text not null check (char_length(key) <= 200),
  created_at timestamptz not null default now()
);
create index rate_limits_key_idx on public.rate_limits (key, created_at desc);
alter table public.rate_limits enable row level security; -- bewusst ohne Policies → nur service_role

-- Zählt + erlaubt atomar: true = erlaubt (und gezählt), false = Limit erreicht
create function public.hit_rate_limit(p_key text, p_limit integer, p_window_seconds integer)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  v_count integer;
begin
  perform pg_advisory_xact_lock(hashtext(p_key));
  select count(*) into v_count from public.rate_limits
   where key = p_key and created_at > now() - make_interval(secs => p_window_seconds);
  if v_count >= p_limit then
    return false;
  end if;
  insert into public.rate_limits (key) values (p_key);
  return true;
end;
$$;

-- Nur prüfen (z. B. fehlgeschlagene Logins pro Account)
create function public.rate_limit_ok(p_key text, p_limit integer, p_window_seconds integer)
returns boolean language sql stable security definer set search_path = '' as $$
  select count(*) < p_limit from public.rate_limits
   where key = p_key and created_at > now() - make_interval(secs => p_window_seconds);
$$;

create function public.rate_limit_record(p_key text)
returns void language sql security definer set search_path = '' as $$
  insert into public.rate_limits (key) values (p_key);
$$;

create function public.rate_limit_clear(p_key text)
returns void language sql security definer set search_path = '' as $$
  delete from public.rate_limits where key = p_key;
$$;

-- ---------------------------------------------------------------------
--  Audit-Protokoll: wer hat wann was Sicherheitsrelevantes getan
-- ---------------------------------------------------------------------
create table public.audit_log (
  id         bigint generated always as identity primary key,
  cohort_id  uuid references public.cohorts (id) on delete cascade,
  actor_id   uuid references auth.users (id) on delete set null,
  actor_name text check (char_length(actor_name) <= 160),
  action     text not null check (char_length(action) <= 80),
  target     text check (char_length(target) <= 300),
  details    jsonb,
  created_at timestamptz not null default now()
);
create index audit_log_cohort_idx on public.audit_log (cohort_id, created_at desc);
create index audit_log_created_idx on public.audit_log (created_at desc);

alter table public.audit_log enable row level security;
create policy "audit_log: Admins lesen" on public.audit_log
  for select to authenticated
  using ((public.is_admin() and cohort_id = public.my_cohort_id()) or public.is_platform_admin());

revoke all on public.audit_log, public.rate_limits from anon, authenticated;
grant select on public.audit_log to authenticated;
grant all on public.audit_log, public.rate_limits to service_role;

-- ---------------------------------------------------------------------
--  Eigener Kalender-Schlüssel per Funktion (die Spalten-Sperre auf profiles folgt erst
--  beim Go-live in supabase/launch/nach-go-live.sql – die bisherige App liest die Spalte noch)
-- ---------------------------------------------------------------------
create function public.my_calendar_token()
returns text language sql stable security definer set search_path = '' as $$
  select calendar_token from public.profiles where id = auth.uid();
$$;

-- ---------------------------------------------------------------------
--  Jeder Jahrgang behält mindestens einen Admin
-- ---------------------------------------------------------------------
create function public.guard_last_admin()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.role = 'admin' and new.role <> 'admin' and not exists (
    select 1 from public.profiles where cohort_id = old.cohort_id and role = 'admin' and id <> old.id
  ) then
    raise exception 'Der Jahrgang braucht mindestens einen Admin.';
  end if;
  return new;
end;
$$;
create trigger profiles_guard_last_admin
  before update of role on public.profiles
  for each row execute function public.guard_last_admin();

-- ---------------------------------------------------------------------
--  "Erstellt von" lässt sich nicht fälschen
-- ---------------------------------------------------------------------
create function public.force_created_by()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is not null then
    new.created_by := auth.uid();
  end if;
  return new;
end;
$$;
create trigger events_force_created_by before insert on public.events
  for each row execute function public.force_created_by();
create trigger announcements_force_created_by before insert on public.announcements
  for each row execute function public.force_created_by();
create trigger polls_force_created_by before insert on public.polls
  for each row execute function public.force_created_by();
create trigger shopping_items_force_created_by before insert on public.shopping_items
  for each row execute function public.force_created_by();

-- ---------------------------------------------------------------------
--  Freischaltung neuer Jahrgänge + 2FA-Pflicht für Admins (pro Jahrgang)
-- ---------------------------------------------------------------------
alter table public.cohorts add column pending boolean not null default false;
alter table public.cohorts add column require_admin_2fa boolean not null default false;
grant update (require_admin_2fa) on public.cohorts to authenticated;

-- 2FA-Pflicht nur einschalten, wer selbst mit 2FA angemeldet ist (sonst sperrt man sich aus)
create function public.guard_cohort_update()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is not null and new.require_admin_2fa and not old.require_admin_2fa
     and coalesce(auth.jwt() ->> 'aal', 'aal1') <> 'aal2' then
    raise exception 'Aktiviere zuerst selbst die Zwei-Faktor-Anmeldung.';
  end if;
  return new;
end;
$$;
create trigger cohorts_guard_update
  before update on public.cohorts
  for each row execute function public.guard_cohort_update();

create or replace function public.my_cohort_id()
returns uuid language sql stable security definer set search_path = '' as $$
  select p.cohort_id
  from public.profiles p
  join public.cohorts c on c.id = p.cohort_id
  where p.id = auth.uid() and c.active and not c.pending;
$$;

-- Admin-Rechte gelten nur mit 2FA-Sitzung, wenn der Jahrgang das verlangt
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p join public.cohorts c on c.id = p.cohort_id
    where p.id = auth.uid() and p.role = 'admin' and c.active and not c.pending
      and (not c.require_admin_2fa or coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2')
  );
$$;

-- Plattform-Admins IMMER nur mit 2FA
create or replace function public.is_platform_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.platform_admins where user_id = auth.uid())
     and coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2';
$$;

-- Eigenen Plattform-Status ohne 2FA lesen können (um zur 2FA-Einrichtung zu leiten)
drop policy "platform_admins: lesen" on public.platform_admins;
create policy "platform_admins: lesen" on public.platform_admins
  for select to authenticated using (user_id = auth.uid());

-- ---------------------------------------------------------------------
--  Alle Sitzungen einer Person beenden (z. B. nach Passwort-Reset durch Admin)
-- ---------------------------------------------------------------------
create function public.revoke_user_sessions(p_user_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  delete from auth.sessions where user_id = p_user_id;
  return true;
exception when insufficient_privilege then
  raise warning 'Sitzungen konnten nicht beendet werden (fehlende Rechte auf auth.sessions)';
  return false;
end;
$$;

-- ---------------------------------------------------------------------
--  Datenbereinigung (läuft täglich über den Cron-Job)
-- ---------------------------------------------------------------------
create function public.run_maintenance()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_result jsonb := '{}'::jsonb;
  v_count  integer;
begin
  delete from public.rate_limits where created_at < now() - interval '2 days';
  get diagnostics v_count = row_count;
  v_result := v_result || jsonb_build_object('rate_limits', v_count);

  delete from public.notifications where created_at < now() - interval '180 days';
  get diagnostics v_count = row_count;
  v_result := v_result || jsonb_build_object('notifications', v_count);

  -- Partner-Klicks nach 90 Tagen anonymisieren (Jahrgang bleibt für die Statistik)
  update public.partner_clicks set user_id = null where user_id is not null and created_at < now() - interval '90 days';
  get diagnostics v_count = row_count;
  v_result := v_result || jsonb_build_object('partner_clicks_anonymisiert', v_count);

  delete from public.audit_log where created_at < now() - interval '400 days';
  get diagnostics v_count = row_count;
  v_result := v_result || jsonb_build_object('audit_log', v_count);

  return v_result;
end;
$$;

-- ---------------------------------------------------------------------
--  Rechte: Server-Funktionen nur für service_role; anon bekommt nie etwas
-- ---------------------------------------------------------------------
revoke execute on all functions in schema public from public, anon;

revoke execute on function
  public.hit_rate_limit(text, integer, integer), public.rate_limit_ok(text, integer, integer),
  public.rate_limit_record(text), public.rate_limit_clear(text),
  public.revoke_user_sessions(uuid), public.run_maintenance()
  from authenticated;
grant execute on function
  public.hit_rate_limit(text, integer, integer), public.rate_limit_ok(text, integer, integer),
  public.rate_limit_record(text), public.rate_limit_clear(text),
  public.revoke_user_sessions(uuid), public.run_maintenance()
  to service_role;

grant execute on function public.my_calendar_token() to authenticated, service_role;

-- Künftige Tabellen und Funktionen: standardmäßig keine Rechte für anon
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on sequences from anon;
alter default privileges in schema public revoke execute on functions from public, anon;
