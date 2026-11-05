-- =====================================================================
--  Orga-Team (Veranstalter) pro Termin mit auswählbaren Rechten
--  + Einkaufsliste pro Termin
-- =====================================================================

-- ---------------------------------------------------------------------
--  Orga-Team
-- ---------------------------------------------------------------------
create table public.event_organizers (
  event_id    uuid not null references public.events (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  permissions text[] not null default array['einkauf']::text[],
  created_at  timestamptz not null default now(),
  primary key (event_id, user_id),
  constraint event_organizers_permissions_check
    check (permissions <@ array['details', 'schichten', 'bedarf', 'sortiment', 'einkauf']::text[])
);
create index event_organizers_user_idx on public.event_organizers (user_id);

create function public.is_organizer(p_event_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.event_organizers where event_id = p_event_id and user_id = auth.uid()
  );
$$;

-- Admin oder Orga-Mitglied mit genau diesem Recht
create function public.can_manage(p_event_id uuid, p_permission text)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_admin() or exists (
    select 1 from public.event_organizers
    where event_id = p_event_id and user_id = auth.uid() and p_permission = any (permissions)
  );
$$;

create function public.shift_event_id(p_shift_id uuid)
returns uuid language sql stable security definer set search_path = '' as $$
  select event_id from public.shifts where id = p_shift_id;
$$;

create function public.need_event_id(p_need_id uuid)
returns uuid language sql stable security definer set search_path = '' as $$
  select event_id from public.event_needs where id = p_need_id;
$$;

-- Orga-Team sieht "seine" Termine auch als Entwurf
create or replace function public.event_is_visible(p_event_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_member() and exists (
    select 1 from public.events e
    where e.id = p_event_id and (e.published or public.is_admin() or public.is_organizer(e.id))
  );
$$;

alter table public.event_organizers enable row level security;
create policy "event_organizers: lesen" on public.event_organizers
  for select to authenticated using (public.is_member());
create policy "event_organizers: Admins verwalten" on public.event_organizers
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------
--  Termine: Orga-Team mit Recht "details" darf bearbeiten,
--  aber nicht veröffentlichen/löschen
-- ---------------------------------------------------------------------
drop policy "events: lesen" on public.events;
drop policy "events: Admins schreiben" on public.events;

create policy "events: lesen" on public.events
  for select to authenticated
  using (public.is_admin() or (public.is_member() and (published or public.is_organizer(id))));
create policy "events: Admins anlegen" on public.events
  for insert to authenticated with check (public.is_admin());
create policy "events: bearbeiten" on public.events
  for update to authenticated
  using (public.can_manage(id, 'details')) with check (public.can_manage(id, 'details'));
create policy "events: Admins löschen" on public.events
  for delete to authenticated using (public.is_admin());

create function public.guard_event_update()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is not null and not public.is_admin()
     and (new.published is distinct from old.published or new.created_by is distinct from old.created_by) then
    raise exception 'Nur Admins können Termine veröffentlichen.';
  end if;
  return new;
end;
$$;
create trigger events_guard_update
  before update on public.events
  for each row execute function public.guard_event_update();

-- ---------------------------------------------------------------------
--  Schichten / Bedarf / Sortiment: Admins oder Orga-Team mit passendem Recht
-- ---------------------------------------------------------------------
drop policy "shifts: Admins schreiben" on public.shifts;
create policy "shifts: verwalten" on public.shifts
  for all to authenticated
  using (public.can_manage(event_id, 'schichten')) with check (public.can_manage(event_id, 'schichten'));

drop policy "event_needs: Admins schreiben" on public.event_needs;
create policy "event_needs: verwalten" on public.event_needs
  for all to authenticated
  using (public.can_manage(event_id, 'bedarf')) with check (public.can_manage(event_id, 'bedarf'));

drop policy "event_products: Admins schreiben" on public.event_products;
create policy "event_products: verwalten" on public.event_products
  for all to authenticated
  using (public.can_manage(event_id, 'sortiment')) with check (public.can_manage(event_id, 'sortiment'));

drop policy "shift_signups: selbst eintragen" on public.shift_signups;
drop policy "shift_signups: Admins bearbeiten" on public.shift_signups;
drop policy "shift_signups: austragen" on public.shift_signups;
create policy "shift_signups: eintragen" on public.shift_signups
  for insert to authenticated
  with check (
    public.can_manage(public.shift_event_id(shift_id), 'schichten')
    or (user_id = auth.uid()
        and exists (select 1 from public.shifts s where s.id = shift_id and s.ends_at > now()))
  );
create policy "shift_signups: verwalten" on public.shift_signups
  for update to authenticated
  using (public.can_manage(public.shift_event_id(shift_id), 'schichten'))
  with check (public.can_manage(public.shift_event_id(shift_id), 'schichten'));
create policy "shift_signups: austragen" on public.shift_signups
  for delete to authenticated
  using (user_id = auth.uid() or public.can_manage(public.shift_event_id(shift_id), 'schichten'));

drop policy "need_pledges: selbst eintragen" on public.need_pledges;
drop policy "need_pledges: bearbeiten" on public.need_pledges;
drop policy "need_pledges: löschen" on public.need_pledges;
create policy "need_pledges: eintragen" on public.need_pledges
  for insert to authenticated
  with check (
    public.can_manage(public.need_event_id(need_id), 'bedarf')
    or (user_id = auth.uid() and exists (select 1 from public.event_needs n where n.id = need_id))
  );
create policy "need_pledges: bearbeiten" on public.need_pledges
  for update to authenticated
  using (user_id = auth.uid() or public.can_manage(public.need_event_id(need_id), 'bedarf'))
  with check (user_id = auth.uid() or public.can_manage(public.need_event_id(need_id), 'bedarf'));
create policy "need_pledges: löschen" on public.need_pledges
  for delete to authenticated
  using (user_id = auth.uid() or public.can_manage(public.need_event_id(need_id), 'bedarf'));

-- Anmerkungen moderieren: auch Orga-Team mit Recht "details"
drop policy "event_comments: löschen" on public.event_comments;
create policy "event_comments: löschen" on public.event_comments
  for delete to authenticated
  using (user_id = auth.uid() or public.can_manage(event_id, 'details'));

-- ---------------------------------------------------------------------
--  Einkaufsliste (nur Admins + Orga-Team sehen sie)
-- ---------------------------------------------------------------------
create table public.shopping_items (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid not null references public.events (id) on delete cascade,
  title       text not null check (char_length(title) between 1 and 200),
  quantity    text check (char_length(quantity) <= 60),
  note        text check (char_length(note) <= 500),
  assigned_to uuid references public.profiles (id) on delete set null,
  cost        numeric(10, 2) check (cost >= 0),
  bought_at   timestamptz,
  bought_by   uuid references public.profiles (id) on delete set null,
  created_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now()
);
create index shopping_items_event_idx on public.shopping_items (event_id);

alter table public.shopping_items enable row level security;
create policy "shopping_items: lesen" on public.shopping_items
  for select to authenticated using (public.is_admin() or public.is_organizer(event_id));
create policy "shopping_items: verwalten" on public.shopping_items
  for all to authenticated
  using (public.can_manage(event_id, 'einkauf')) with check (public.can_manage(event_id, 'einkauf'));

-- ---------------------------------------------------------------------
--  Benachrichtigungen
-- ---------------------------------------------------------------------
create function public.notify_organizer_added()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.notifications (user_id, title, body, link)
  select new.user_id, 'Du bist im Orga-Team: ' || e.title,
         'Du kannst diesen Termin jetzt mitverwalten.', '/termine/' || e.id || '/verwalten'
  from public.events e where e.id = new.event_id;
  return new;
end;
$$;
create trigger event_organizers_notify
  after insert on public.event_organizers
  for each row execute function public.notify_organizer_added();

create function public.notify_shopping_assigned()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.assigned_to is not null
     and new.assigned_to is distinct from auth.uid()
     and (tg_op = 'INSERT' or new.assigned_to is distinct from old.assigned_to) then
    insert into public.notifications (user_id, title, body, link)
    select new.assigned_to, 'Einkauf für dich: ' || new.title,
           e.title || coalesce(' · ' || new.quantity, ''), '/termine/' || e.id || '/verwalten#einkauf'
    from public.events e where e.id = new.event_id;
  end if;
  return new;
end;
$$;
create trigger shopping_items_notify
  after insert or update of assigned_to on public.shopping_items
  for each row execute function public.notify_shopping_assigned();

-- ---------------------------------------------------------------------
--  Rechte
-- ---------------------------------------------------------------------
revoke all on public.event_organizers, public.shopping_items from anon;
grant select, insert, update, delete on public.event_organizers, public.shopping_items to authenticated;
grant all on public.event_organizers, public.shopping_items to service_role;

revoke execute on function
  public.is_organizer(uuid), public.can_manage(uuid, text), public.shift_event_id(uuid), public.need_event_id(uuid),
  public.guard_event_update(), public.notify_organizer_added(), public.notify_shopping_assigned()
  from public, anon;
grant execute on function
  public.is_organizer(uuid), public.can_manage(uuid, text), public.shift_event_id(uuid), public.need_event_id(uuid)
  to authenticated, service_role;
