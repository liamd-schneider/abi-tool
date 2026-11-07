-- =====================================================================
--  Mehrschulen-Plattform
--  Schulen → Jahrgänge (Mandanten). Jeder Jahrgang ist komplett abgeschottet.
--  Bestehende Daten werden automatisch dem ersten Jahrgang zugeordnet.
--  + Plattform-Admins, Partner-Hub mit Klick-Tracking
-- =====================================================================

-- ---------------------------------------------------------------------
--  Schulen & Jahrgänge
-- ---------------------------------------------------------------------
create table public.schools (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (char_length(name) between 2 and 160),
  city       text check (char_length(city) <= 100),
  created_at timestamptz not null default now()
);

create table public.cohorts (
  id           uuid primary key default gen_random_uuid(),
  school_id    uuid not null references public.schools (id) on delete cascade,
  name         text not null check (char_length(name) between 2 and 80),      -- z. B. "Abi 2027"
  grad_year    integer check (grad_year between 2000 and 2100),
  slug         text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,62}$'), -- für den Login-Link
  join_code    text not null unique check (join_code ~ '^[A-Z0-9]{6,12}$'),  -- Jahrgangs-Code
  email_domain text not null unique,                                          -- interne Login-Domain
  active       boolean not null default true,
  created_at   timestamptz not null default now()
);
create index cohorts_school_idx on public.cohorts (school_id);

-- Betreiber der Plattform (dürfen Partner pflegen, Jahrgänge sperren …)
create table public.platform_admins (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
--  Jahrgangs-Zuordnung an den "obersten" Tabellen
--  (alle anderen hängen an Terminen, Umfragen oder Personen)
-- ---------------------------------------------------------------------
alter table public.profiles      add column cohort_id uuid references public.cohorts (id) on delete cascade;
alter table public.events        add column cohort_id uuid references public.cohorts (id) on delete cascade;
alter table public.announcements add column cohort_id uuid references public.cohorts (id) on delete cascade;
alter table public.polls         add column cohort_id uuid references public.cohorts (id) on delete cascade;

-- Bestehende Daten (der erste Jahrgang) übernehmen – Logins bleiben gleich (Domain abi.local)
do $$
declare
  v_school uuid;
  v_cohort uuid;
begin
  if exists (select 1 from public.profiles) then
    insert into public.schools (name) values ('Unsere Schule') returning id into v_school;
    insert into public.cohorts (school_id, name, grad_year, slug, join_code, email_domain)
    values (v_school, 'Abi 2027', 2027, 'abi-2027',
            upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)), 'abi.local')
    returning id into v_cohort;

    update public.profiles      set cohort_id = v_cohort where cohort_id is null;
    update public.events        set cohort_id = v_cohort where cohort_id is null;
    update public.announcements set cohort_id = v_cohort where cohort_id is null;
    update public.polls         set cohort_id = v_cohort where cohort_id is null;
  end if;
end;
$$;

alter table public.profiles      alter column cohort_id set not null;
alter table public.events        alter column cohort_id set not null;
alter table public.announcements alter column cohort_id set not null;
alter table public.polls         alter column cohort_id set not null;

create index profiles_cohort_idx      on public.profiles (cohort_id);
create index events_cohort_idx        on public.events (cohort_id);
create index announcements_cohort_idx on public.announcements (cohort_id);
create index polls_cohort_idx         on public.polls (cohort_id);

-- Benutzernamen sind nur noch pro Jahrgang eindeutig
alter table public.profiles drop constraint profiles_username_key;
alter table public.profiles add constraint profiles_cohort_username_key unique (cohort_id, username);

-- ---------------------------------------------------------------------
--  Hilfsfunktionen
-- ---------------------------------------------------------------------

-- Jahrgang der angemeldeten Person (null, wenn nicht angemeldet oder Jahrgang gesperrt)
create function public.my_cohort_id()
returns uuid language sql stable security definer set search_path = '' as $$
  select p.cohort_id
  from public.profiles p
  join public.cohorts c on c.id = p.cohort_id
  where p.id = auth.uid() and c.active;
$$;

create function public.is_platform_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.platform_admins where user_id = auth.uid());
$$;

create function public.in_my_cohort(p_user_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles where id = p_user_id and cohort_id = public.my_cohort_id()
  );
$$;

create function public.event_cohort_id(p_event_id uuid)
returns uuid language sql stable security definer set search_path = '' as $$
  select cohort_id from public.events where id = p_event_id;
$$;

-- Neue Zeilen landen automatisch im eigenen Jahrgang
alter table public.events        alter column cohort_id set default public.my_cohort_id();
alter table public.announcements alter column cohort_id set default public.my_cohort_id();
alter table public.polls         alter column cohort_id set default public.my_cohort_id();

-- Mitglied = Profil in einem aktiven Jahrgang
create or replace function public.is_member()
returns boolean language sql stable security definer set search_path = '' as $$
  select public.my_cohort_id() is not null;
$$;

-- Admin = Admin des eigenen (aktiven) Jahrgangs
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p join public.cohorts c on c.id = p.cohort_id
    where p.id = auth.uid() and p.role = 'admin' and c.active
  );
$$;

create or replace function public.event_is_visible(p_event_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.events e
    where e.id = p_event_id
      and e.cohort_id = public.my_cohort_id()
      and (e.published or public.is_admin() or public.is_organizer(e.id))
  );
$$;

create or replace function public.can_manage(p_event_id uuid, p_permission text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.events e where e.id = p_event_id and e.cohort_id = public.my_cohort_id())
     and (
       public.is_admin()
       or exists (
         select 1 from public.event_organizers o
         where o.event_id = p_event_id and o.user_id = auth.uid() and p_permission = any (o.permissions)
       )
     );
$$;

-- Termine dürfen den Jahrgang nie wechseln; veröffentlichen nur Admins
create or replace function public.guard_event_update()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is not null and new.cohort_id is distinct from old.cohort_id then
    raise exception 'Termine können nicht in einen anderen Jahrgang verschoben werden.';
  end if;
  if auth.uid() is not null and not public.is_admin()
     and (new.published is distinct from old.published or new.created_by is distinct from old.created_by) then
    raise exception 'Nur Admins können Termine veröffentlichen.';
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------
--  Abstimmen / Ergebnisse nur im eigenen Jahrgang
-- ---------------------------------------------------------------------
create or replace function public.cast_vote(p_poll_id uuid, p_option_ids uuid[])
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_poll  public.polls;
  v_count integer := coalesce(array_length(p_option_ids, 1), 0);
begin
  if not public.is_member() then
    raise exception 'Nicht angemeldet.';
  end if;

  select * into v_poll from public.polls where id = p_poll_id;
  if not found or v_poll.cohort_id is distinct from public.my_cohort_id() then
    raise exception 'Abstimmung nicht gefunden.';
  end if;
  if v_poll.closed or (v_poll.closes_at is not null and v_poll.closes_at < now()) then
    raise exception 'Die Abstimmung ist bereits beendet.';
  end if;
  if not v_poll.allow_multiple and v_count > 1 then
    raise exception 'Hier ist nur eine Stimme erlaubt.';
  end if;
  if exists (
    select 1 from unnest(p_option_ids) as t(option_id)
    where t.option_id not in (select id from public.poll_options where poll_id = p_poll_id)
  ) then
    raise exception 'Ungültige Antwortoption.';
  end if;

  delete from public.poll_votes where poll_id = p_poll_id and user_id = auth.uid();

  if v_count > 0 then
    insert into public.poll_votes (poll_id, option_id, user_id)
    select distinct p_poll_id, t.option_id, auth.uid() from unnest(p_option_ids) as t(option_id);
  end if;
end;
$$;

create or replace function public.poll_results(p_poll_id uuid)
returns table (option_id uuid, votes bigint, voters bigint)
language sql stable security definer set search_path = '' as $$
  select o.id,
         count(v.user_id),
         (select count(distinct v2.user_id) from public.poll_votes v2 where v2.poll_id = p_poll_id)
  from public.poll_options o
  left join public.poll_votes v on v.option_id = o.id
  where o.poll_id = p_poll_id
    and exists (select 1 from public.polls p where p.id = p_poll_id and p.cohort_id = public.my_cohort_id())
  group by o.id;
$$;

-- ---------------------------------------------------------------------
--  Benachrichtigungen "an alle" nur an den eigenen Jahrgang
-- ---------------------------------------------------------------------
create or replace function public.notify_announcement()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.notifications (user_id, title, body, link)
  select p.id, 'Neuigkeit: ' || new.title, left(new.body, 200), '/neuigkeiten'
  from public.profiles p
  where p.cohort_id = new.cohort_id and p.id is distinct from new.created_by;
  return new;
end;
$$;

create or replace function public.notify_poll()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.notifications (user_id, title, body, link)
  select p.id, 'Neue Abstimmung', new.question, '/abstimmungen/' || new.id
  from public.profiles p
  where p.cohort_id = new.cohort_id and p.id is distinct from new.created_by;
  return new;
end;
$$;

create or replace function public.notify_event()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.published and (tg_op = 'INSERT' or not old.published) then
    insert into public.notifications (user_id, title, body, link)
    select p.id, 'Neuer Termin: ' || new.title, null, '/termine/' || new.id
    from public.profiles p
    where p.cohort_id = new.cohort_id and p.id is distinct from new.created_by;
  elsif tg_op = 'UPDATE' and new.published and (
        new.starts_at is distinct from old.starts_at
     or new.ends_at   is distinct from old.ends_at
     or new.address   is distinct from old.address
     or new.location_name is distinct from old.location_name) then
    insert into public.notifications (user_id, title, body, link)
    select distinct ss.user_id, 'Termin geändert: ' || new.title,
           'Zeit oder Ort wurden angepasst – bitte prüfen.', '/termine/' || new.id
    from public.shift_signups ss
    join public.shifts s on s.id = ss.shift_id
    where s.event_id = new.id;
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------
--  Row Level Security: überall den Jahrgang prüfen
-- ---------------------------------------------------------------------

-- profiles
drop policy "profiles: Mitglieder lesen" on public.profiles;
drop policy "profiles: Admins bearbeiten" on public.profiles;
create policy "profiles: eigener Jahrgang" on public.profiles
  for select to authenticated using (cohort_id = public.my_cohort_id() or id = auth.uid());
create policy "profiles: Admins bearbeiten" on public.profiles
  for update to authenticated
  using (public.is_admin() and cohort_id = public.my_cohort_id())
  with check (public.is_admin() and cohort_id = public.my_cohort_id());

-- events
drop policy "events: lesen" on public.events;
drop policy "events: Admins anlegen" on public.events;
drop policy "events: bearbeiten" on public.events;
drop policy "events: Admins löschen" on public.events;
create policy "events: lesen" on public.events
  for select to authenticated
  using (cohort_id = public.my_cohort_id() and (public.is_admin() or published or public.is_organizer(id)));
create policy "events: Admins anlegen" on public.events
  for insert to authenticated with check (public.is_admin() and cohort_id = public.my_cohort_id());
create policy "events: bearbeiten" on public.events
  for update to authenticated
  using (public.can_manage(id, 'details'))
  with check (public.can_manage(id, 'details') and cohort_id = public.my_cohort_id());
create policy "events: Admins löschen" on public.events
  for delete to authenticated using (public.is_admin() and cohort_id = public.my_cohort_id());

-- announcements
drop policy "announcements: lesen" on public.announcements;
drop policy "announcements: Admins schreiben" on public.announcements;
create policy "announcements: lesen" on public.announcements
  for select to authenticated using (cohort_id = public.my_cohort_id());
create policy "announcements: Admins schreiben" on public.announcements
  for all to authenticated
  using (public.is_admin() and cohort_id = public.my_cohort_id())
  with check (public.is_admin() and cohort_id = public.my_cohort_id());

-- polls / options / votes
drop policy "polls: lesen" on public.polls;
drop policy "polls: Admins schreiben" on public.polls;
create policy "polls: lesen" on public.polls
  for select to authenticated using (cohort_id = public.my_cohort_id());
create policy "polls: Admins schreiben" on public.polls
  for all to authenticated
  using (public.is_admin() and cohort_id = public.my_cohort_id())
  with check (public.is_admin() and cohort_id = public.my_cohort_id());

drop policy "poll_options: lesen" on public.poll_options;
drop policy "poll_options: Admins schreiben" on public.poll_options;
create policy "poll_options: lesen" on public.poll_options
  for select to authenticated
  using (exists (select 1 from public.polls p where p.id = poll_id));
create policy "poll_options: Admins schreiben" on public.poll_options
  for all to authenticated
  using (public.is_admin() and exists (select 1 from public.polls p where p.id = poll_id))
  with check (public.is_admin() and exists (select 1 from public.polls p where p.id = poll_id));

drop policy "poll_votes: lesen" on public.poll_votes;
create policy "poll_votes: lesen" on public.poll_votes
  for select to authenticated
  using (
    user_id = auth.uid()
    or exists (select 1 from public.polls p where p.id = poll_id and not p.anonymous)
  );

-- Schicht-Eintragungen: andere nur aus dem eigenen Jahrgang eintragen
drop policy "shift_signups: eintragen" on public.shift_signups;
create policy "shift_signups: eintragen" on public.shift_signups
  for insert to authenticated
  with check (
    (public.can_manage(public.shift_event_id(shift_id), 'schichten') and public.in_my_cohort(user_id))
    or (user_id = auth.uid()
        and exists (select 1 from public.shifts s where s.id = shift_id and s.ends_at > now()))
  );

-- Spenden: dito
drop policy "need_pledges: eintragen" on public.need_pledges;
drop policy "need_pledges: bearbeiten" on public.need_pledges;
create policy "need_pledges: eintragen" on public.need_pledges
  for insert to authenticated
  with check (
    (public.can_manage(public.need_event_id(need_id), 'bedarf') and public.in_my_cohort(user_id))
    or (user_id = auth.uid() and exists (select 1 from public.event_needs n where n.id = need_id))
  );
create policy "need_pledges: bearbeiten" on public.need_pledges
  for update to authenticated
  using (user_id = auth.uid() or public.can_manage(public.need_event_id(need_id), 'bedarf'))
  with check (
    user_id = auth.uid()
    or (public.can_manage(public.need_event_id(need_id), 'bedarf') and public.in_my_cohort(user_id))
  );

-- Orga-Team: nur Admins des Jahrgangs, nur Leute aus dem Jahrgang
drop policy "event_organizers: lesen" on public.event_organizers;
drop policy "event_organizers: Admins verwalten" on public.event_organizers;
create policy "event_organizers: lesen" on public.event_organizers
  for select to authenticated
  using (exists (select 1 from public.events e where e.id = event_id));
create policy "event_organizers: Admins verwalten" on public.event_organizers
  for all to authenticated
  using (public.is_admin() and public.event_cohort_id(event_id) = public.my_cohort_id())
  with check (public.is_admin() and public.event_cohort_id(event_id) = public.my_cohort_id() and public.in_my_cohort(user_id));

-- Einkaufsliste
drop policy "shopping_items: lesen" on public.shopping_items;
drop policy "shopping_items: verwalten" on public.shopping_items;
create policy "shopping_items: lesen" on public.shopping_items
  for select to authenticated
  using ((public.is_admin() and public.event_cohort_id(event_id) = public.my_cohort_id()) or public.is_organizer(event_id));
create policy "shopping_items: verwalten" on public.shopping_items
  for all to authenticated
  using (public.can_manage(event_id, 'einkauf'))
  with check (public.can_manage(event_id, 'einkauf') and (assigned_to is null or public.in_my_cohort(assigned_to)));

-- Benachrichtigungen: Admins nur an den eigenen Jahrgang
drop policy "notifications: Admins senden" on public.notifications;
create policy "notifications: Admins senden" on public.notifications
  for insert to authenticated with check (public.is_admin() and public.in_my_cohort(user_id));

-- ---------------------------------------------------------------------
--  Schulen / Jahrgänge / Plattform-Admins
-- ---------------------------------------------------------------------
alter table public.schools         enable row level security;
alter table public.cohorts         enable row level security;
alter table public.platform_admins enable row level security;

create policy "cohorts: eigener" on public.cohorts
  for select to authenticated using (id = public.my_cohort_id() or public.is_platform_admin());
create policy "cohorts: Admins bearbeiten" on public.cohorts
  for update to authenticated
  using (public.is_admin() and id = public.my_cohort_id())
  with check (public.is_admin() and id = public.my_cohort_id());

create policy "schools: eigene" on public.schools
  for select to authenticated
  using (
    exists (select 1 from public.cohorts c where c.school_id = id and c.id = public.my_cohort_id())
    or public.is_platform_admin()
  );
create policy "schools: Admins bearbeiten" on public.schools
  for update to authenticated
  using (public.is_admin() and exists (select 1 from public.cohorts c where c.school_id = id and c.id = public.my_cohort_id()))
  with check (public.is_admin() and exists (select 1 from public.cohorts c where c.school_id = id and c.id = public.my_cohort_id()));

create policy "platform_admins: lesen" on public.platform_admins
  for select to authenticated using (user_id = auth.uid() or public.is_platform_admin());

-- Admins dürfen nur Anzeigenamen ändern – Slug, Code, Domain und Sperre laufen serverseitig
revoke all on public.schools, public.cohorts, public.platform_admins from anon, authenticated;
grant select on public.schools, public.cohorts, public.platform_admins to authenticated;
grant update (name, city) on public.schools to authenticated;
grant update (name, grad_year) on public.cohorts to authenticated;
grant all on public.schools, public.cohorts, public.platform_admins to service_role;

-- ---------------------------------------------------------------------
--  Partner-Hub (darüber finanziert sich die Plattform)
-- ---------------------------------------------------------------------
create table public.partners (
  id            uuid primary key default gen_random_uuid(),
  name          text not null check (char_length(name) between 1 and 120),
  category      text not null check (char_length(category) between 1 and 60),
  description   text check (char_length(description) <= 600),
  url           text not null check (url ~ '^https://'),
  logo_url      text check (logo_url is null or logo_url ~ '^https://'),
  discount_code text check (char_length(discount_code) <= 60),
  highlight     text check (char_length(highlight) <= 80),   -- z. B. "10 % für Abi-Jahrgänge"
  sort_order    integer not null default 0,
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);

create table public.partner_clicks (
  id         bigint generated always as identity primary key,
  partner_id uuid not null references public.partners (id) on delete cascade,
  cohort_id  uuid references public.cohorts (id) on delete set null,
  user_id    uuid references auth.users (id) on delete set null,
  source     text check (char_length(source) <= 40),          -- "app", "landing" …
  created_at timestamptz not null default now()
);
create index partner_clicks_partner_idx on public.partner_clicks (partner_id, created_at desc);

alter table public.partners       enable row level security;
alter table public.partner_clicks enable row level security;

create policy "partners: lesen" on public.partners
  for select to authenticated using (active or public.is_platform_admin());
create policy "partners: Plattform verwaltet" on public.partners
  for all to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());
create policy "partner_clicks: Plattform liest" on public.partner_clicks
  for select to authenticated using (public.is_platform_admin());

revoke all on public.partners, public.partner_clicks from anon;
grant select, insert, update, delete on public.partners to authenticated;
grant select on public.partner_clicks to authenticated;
grant all on public.partners, public.partner_clicks to service_role;

-- ---------------------------------------------------------------------
--  Funktions-Rechte
-- ---------------------------------------------------------------------
revoke execute on function
  public.my_cohort_id(), public.is_platform_admin(), public.in_my_cohort(uuid), public.event_cohort_id(uuid)
  from public, anon;
grant execute on function
  public.my_cohort_id(), public.is_platform_admin(), public.in_my_cohort(uuid), public.event_cohort_id(uuid)
  to authenticated, service_role;
