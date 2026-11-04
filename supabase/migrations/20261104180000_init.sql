-- =====================================================================
--  Abi-Tool – Grundschema
--  Rollen: admin (Abikomitee) / member (Jahrgang)
--  Accounts werden ausschließlich von Admins (Service-Key) angelegt.
-- =====================================================================

create type public.user_role as enum ('admin', 'member');
create type public.need_kind as enum ('spende', 'leihgabe', 'material');

-- ---------------------------------------------------------------------
--  Profile
-- ---------------------------------------------------------------------
create table public.profiles (
  id             uuid primary key references auth.users (id) on delete cascade,
  username       text not null unique,
  full_name      text not null,
  role           public.user_role not null default 'member',
  calendar_token text not null unique default replace(gen_random_uuid()::text, '-', ''),
  created_at     timestamptz not null default now()
);

-- Hilfsfunktionen für RLS (security definer → keine RLS-Rekursion)
create function public.is_member()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = auth.uid());
$$;

create function public.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- ---------------------------------------------------------------------
--  Events / Termine
-- ---------------------------------------------------------------------
create table public.events (
  id            uuid primary key default gen_random_uuid(),
  title         text not null check (char_length(title) between 1 and 200),
  description   text,
  starts_at     timestamptz not null,
  ends_at       timestamptz,
  location_name text,
  address       text,
  maps_url      text,
  notes         text,                     -- Hinweise vom Komitee
  published     boolean not null default false,
  created_by    uuid references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now(),
  check (ends_at is null or ends_at >= starts_at)
);
create index events_starts_at_idx on public.events (starts_at);

create function public.event_is_visible(p_event_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_member() and exists (
    select 1 from public.events e
    where e.id = p_event_id and (e.published or public.is_admin())
  );
$$;

-- ---------------------------------------------------------------------
--  Schichten
-- ---------------------------------------------------------------------
create table public.shifts (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid not null references public.events (id) on delete cascade,
  title       text not null check (char_length(title) between 1 and 120),
  description text,
  starts_at   timestamptz not null,
  ends_at     timestamptz not null,
  capacity    integer not null default 1 check (capacity between 1 and 500),
  created_at  timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index shifts_event_idx on public.shifts (event_id);
create index shifts_starts_at_idx on public.shifts (starts_at);

create table public.shift_signups (
  shift_id    uuid not null references public.shifts (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  created_at  timestamptz not null default now(),
  attended    boolean,                    -- null = noch nicht erfasst
  reminded_at timestamptz,                -- Erinnerung verschickt
  primary key (shift_id, user_id)
);
create index shift_signups_user_idx on public.shift_signups (user_id);

-- Überbuchung verhindern (auch bei gleichzeitigen Anmeldungen)
create function public.check_shift_capacity()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_capacity integer;
  v_count    integer;
begin
  select capacity into v_capacity from public.shifts where id = new.shift_id for update;
  if v_capacity is null then
    raise exception 'Schicht nicht gefunden.';
  end if;
  select count(*) into v_count from public.shift_signups where shift_id = new.shift_id;
  if v_count >= v_capacity then
    raise exception 'Diese Schicht ist leider schon voll.';
  end if;
  return new;
end;
$$;

create trigger shift_signups_capacity
  before insert on public.shift_signups
  for each row execute function public.check_shift_capacity();

-- ---------------------------------------------------------------------
--  Bedarf: Spenden (Kuchen, Waffelteig…), Leihgaben (Pavillon…), Material
-- ---------------------------------------------------------------------
create table public.event_needs (
  id              uuid primary key default gen_random_uuid(),
  event_id        uuid not null references public.events (id) on delete cascade,
  kind            public.need_kind not null default 'spende',
  title           text not null check (char_length(title) between 1 and 120),
  description     text,
  quantity_needed integer not null default 1 check (quantity_needed between 1 and 10000),
  unit            text,                   -- z. B. "Stück", "Bleche", "Liter"
  created_at      timestamptz not null default now()
);
create index event_needs_event_idx on public.event_needs (event_id);

create table public.need_pledges (
  id         uuid primary key default gen_random_uuid(),
  need_id    uuid not null references public.event_needs (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  quantity   integer not null default 1 check (quantity between 1 and 10000),
  note       text,
  delivered  boolean,
  created_at timestamptz not null default now(),
  unique (need_id, user_id)
);
create index need_pledges_user_idx on public.need_pledges (user_id);

create function public.check_need_quantity()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_needed integer;
  v_sum    integer;
begin
  select quantity_needed into v_needed from public.event_needs where id = new.need_id for update;
  if v_needed is null then
    raise exception 'Eintrag nicht gefunden.';
  end if;
  select coalesce(sum(quantity), 0) into v_sum
    from public.need_pledges where need_id = new.need_id and id <> new.id;
  if v_sum + new.quantity > v_needed then
    raise exception 'Es werden nur noch % benötigt.', greatest(v_needed - v_sum, 0);
  end if;
  return new;
end;
$$;

create trigger need_pledges_quantity
  before insert or update of quantity on public.need_pledges
  for each row execute function public.check_need_quantity();

-- ---------------------------------------------------------------------
--  Sortiment
-- ---------------------------------------------------------------------
create table public.event_products (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid not null references public.events (id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 120),
  price       numeric(8, 2),
  description text,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);
create index event_products_event_idx on public.event_products (event_id);

-- ---------------------------------------------------------------------
--  Anmerkungen / Kommentare zu Events
-- ---------------------------------------------------------------------
create table public.event_comments (
  id         uuid primary key default gen_random_uuid(),
  event_id   uuid not null references public.events (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  body       text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index event_comments_event_idx on public.event_comments (event_id);

-- ---------------------------------------------------------------------
--  Neuigkeiten
-- ---------------------------------------------------------------------
create table public.announcements (
  id         uuid primary key default gen_random_uuid(),
  title      text not null check (char_length(title) between 1 and 200),
  body       text not null default '',
  pinned     boolean not null default false,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
--  Persönliche Benachrichtigungen
-- ---------------------------------------------------------------------
create table public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  title      text not null,
  body       text,
  link       text,
  read_at    timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);

-- ---------------------------------------------------------------------
--  Abstimmungen (wie WhatsApp-Umfragen)
-- ---------------------------------------------------------------------
create table public.polls (
  id             uuid primary key default gen_random_uuid(),
  question       text not null check (char_length(question) between 1 and 300),
  description    text,
  allow_multiple boolean not null default false,
  anonymous      boolean not null default false,
  closes_at      timestamptz,
  closed         boolean not null default false,
  created_by     uuid references public.profiles (id) on delete set null,
  created_at     timestamptz not null default now()
);

create table public.poll_options (
  id         uuid primary key default gen_random_uuid(),
  poll_id    uuid not null references public.polls (id) on delete cascade,
  label      text not null check (char_length(label) between 1 and 200),
  sort_order integer not null default 0
);
create index poll_options_poll_idx on public.poll_options (poll_id);

create table public.poll_votes (
  poll_id    uuid not null references public.polls (id) on delete cascade,
  option_id  uuid not null references public.poll_options (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (option_id, user_id)
);
create index poll_votes_poll_idx on public.poll_votes (poll_id);

-- Abstimmen: ersetzt die bisherige Stimme der Person (leeres Array = Stimme zurückziehen)
create function public.cast_vote(p_poll_id uuid, p_option_ids uuid[])
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_poll  public.polls;
  v_count integer := coalesce(array_length(p_option_ids, 1), 0);
begin
  if not public.is_member() then
    raise exception 'Nicht angemeldet.';
  end if;

  select * into v_poll from public.polls where id = p_poll_id;
  if not found then
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

-- Ergebnisse (funktioniert auch bei anonymen Umfragen, ohne Namen preiszugeben)
create function public.poll_results(p_poll_id uuid)
returns table (option_id uuid, votes bigint, voters bigint)
language sql stable security definer set search_path = '' as $$
  select o.id,
         count(v.user_id),
         (select count(distinct v2.user_id) from public.poll_votes v2 where v2.poll_id = p_poll_id)
  from public.poll_options o
  left join public.poll_votes v on v.option_id = o.id
  where o.poll_id = p_poll_id and public.is_member()
  group by o.id;
$$;

-- =====================================================================
--  Automatische Benachrichtigungen
-- =====================================================================

-- Neue Neuigkeit → alle
create function public.notify_announcement()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.notifications (user_id, title, body, link)
  select p.id, 'Neuigkeit: ' || new.title, left(new.body, 200), '/neuigkeiten'
  from public.profiles p
  where p.id is distinct from new.created_by;
  return new;
end;
$$;
create trigger announcements_notify
  after insert on public.announcements
  for each row execute function public.notify_announcement();

-- Neue Abstimmung → alle
create function public.notify_poll()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.notifications (user_id, title, body, link)
  select p.id, 'Neue Abstimmung', new.question, '/abstimmungen/' || new.id
  from public.profiles p
  where p.id is distinct from new.created_by;
  return new;
end;
$$;
create trigger polls_notify
  after insert on public.polls
  for each row execute function public.notify_poll();

-- Termin veröffentlicht → alle; Zeit/Ort geändert → alle mit Schicht in dem Termin
create function public.notify_event()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.published and (tg_op = 'INSERT' or not old.published) then
    insert into public.notifications (user_id, title, body, link)
    select p.id, 'Neuer Termin: ' || new.title, null, '/termine/' || new.id
    from public.profiles p
    where p.id is distinct from new.created_by;
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
create trigger events_notify
  after insert or update on public.events
  for each row execute function public.notify_event();

-- Schichtzeit geändert → Eingetragene informieren
create function public.notify_shift_changed()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.starts_at is distinct from old.starts_at or new.ends_at is distinct from old.ends_at then
    insert into public.notifications (user_id, title, body, link)
    select ss.user_id, 'Schicht geändert: ' || new.title,
           'Die Uhrzeit deiner Schicht wurde angepasst.', '/termine/' || new.event_id
    from public.shift_signups ss where ss.shift_id = new.id;
  end if;
  return new;
end;
$$;
create trigger shifts_notify_changed
  after update on public.shifts
  for each row execute function public.notify_shift_changed();

-- Schicht gelöscht → Eingetragene informieren
create function public.notify_shift_deleted()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.notifications (user_id, title, body, link)
  select ss.user_id, 'Schicht gestrichen: ' || old.title,
         'Eine Schicht, für die du eingetragen warst, wurde entfernt.', '/termine/' || old.event_id
  from public.shift_signups ss where ss.shift_id = old.id;
  return old;
end;
$$;
create trigger shifts_notify_deleted
  before delete on public.shifts
  for each row execute function public.notify_shift_deleted();

-- =====================================================================
--  Row Level Security
-- =====================================================================
alter table public.profiles       enable row level security;
alter table public.events         enable row level security;
alter table public.shifts         enable row level security;
alter table public.shift_signups  enable row level security;
alter table public.event_needs    enable row level security;
alter table public.need_pledges   enable row level security;
alter table public.event_products enable row level security;
alter table public.event_comments enable row level security;
alter table public.announcements  enable row level security;
alter table public.notifications  enable row level security;
alter table public.polls          enable row level security;
alter table public.poll_options   enable row level security;
alter table public.poll_votes     enable row level security;

-- profiles
create policy "profiles: Mitglieder lesen" on public.profiles
  for select to authenticated using (public.is_member());
create policy "profiles: Admins bearbeiten" on public.profiles
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- events
create policy "events: lesen" on public.events
  for select to authenticated using (public.is_admin() or (published and public.is_member()));
create policy "events: Admins schreiben" on public.events
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- shifts / needs / products: sichtbar, wenn das Event sichtbar ist
create policy "shifts: lesen" on public.shifts
  for select to authenticated using (public.event_is_visible(event_id));
create policy "shifts: Admins schreiben" on public.shifts
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "event_needs: lesen" on public.event_needs
  for select to authenticated using (public.event_is_visible(event_id));
create policy "event_needs: Admins schreiben" on public.event_needs
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "event_products: lesen" on public.event_products
  for select to authenticated using (public.event_is_visible(event_id));
create policy "event_products: Admins schreiben" on public.event_products
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- shift_signups: alle sehen, wer wo eingetragen ist
create policy "shift_signups: lesen" on public.shift_signups
  for select to authenticated
  using (public.is_member() and exists (select 1 from public.shifts s where s.id = shift_id));
create policy "shift_signups: selbst eintragen" on public.shift_signups
  for insert to authenticated
  with check (
    public.is_admin()
    or (user_id = auth.uid()
        and exists (select 1 from public.shifts s where s.id = shift_id and s.ends_at > now()))
  );
create policy "shift_signups: Admins bearbeiten" on public.shift_signups
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "shift_signups: austragen" on public.shift_signups
  for delete to authenticated using (user_id = auth.uid() or public.is_admin());

-- need_pledges
create policy "need_pledges: lesen" on public.need_pledges
  for select to authenticated
  using (public.is_member() and exists (select 1 from public.event_needs n where n.id = need_id));
create policy "need_pledges: selbst eintragen" on public.need_pledges
  for insert to authenticated
  with check (
    public.is_admin()
    or (user_id = auth.uid() and exists (select 1 from public.event_needs n where n.id = need_id))
  );
create policy "need_pledges: bearbeiten" on public.need_pledges
  for update to authenticated
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());
create policy "need_pledges: löschen" on public.need_pledges
  for delete to authenticated using (user_id = auth.uid() or public.is_admin());

-- event_comments
create policy "event_comments: lesen" on public.event_comments
  for select to authenticated using (public.event_is_visible(event_id));
create policy "event_comments: schreiben" on public.event_comments
  for insert to authenticated
  with check (user_id = auth.uid() and public.event_is_visible(event_id));
create policy "event_comments: löschen" on public.event_comments
  for delete to authenticated using (user_id = auth.uid() or public.is_admin());

-- announcements
create policy "announcements: lesen" on public.announcements
  for select to authenticated using (public.is_member());
create policy "announcements: Admins schreiben" on public.announcements
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- notifications
create policy "notifications: eigene lesen" on public.notifications
  for select to authenticated using (user_id = auth.uid());
create policy "notifications: eigene markieren" on public.notifications
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "notifications: eigene löschen" on public.notifications
  for delete to authenticated using (user_id = auth.uid());
create policy "notifications: Admins senden" on public.notifications
  for insert to authenticated with check (public.is_admin());

-- polls / options
create policy "polls: lesen" on public.polls
  for select to authenticated using (public.is_member());
create policy "polls: Admins schreiben" on public.polls
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "poll_options: lesen" on public.poll_options
  for select to authenticated using (public.is_member());
create policy "poll_options: Admins schreiben" on public.poll_options
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- poll_votes: eigene Stimme immer, fremde nur bei nicht-anonymen Umfragen.
-- Schreiben ausschließlich über cast_vote().
create policy "poll_votes: lesen" on public.poll_votes
  for select to authenticated
  using (
    user_id = auth.uid()
    or (public.is_member() and exists (select 1 from public.polls p where p.id = poll_id and not p.anonymous))
  );

-- =====================================================================
--  Rechte: kein Zugriff für nicht eingeloggte Besucher
-- =====================================================================
revoke all on all tables in schema public from anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant all on all tables in schema public to service_role;

revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;
