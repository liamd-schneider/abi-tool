-- Mengenprüfung: den eigenen bisherigen Eintrag (gleiche Person) nicht mitzählen,
-- damit Ändern per Upsert funktioniert.
create or replace function public.check_need_quantity()
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
    from public.need_pledges
   where need_id = new.need_id and user_id <> new.user_id;
  if v_sum + new.quantity > v_needed then
    raise exception 'Es werden nur noch % benötigt.', greatest(v_needed - v_sum, 0);
  end if;
  return new;
end;
$$;

-- Bei geänderter Schichtzeit Erinnerung erneut verschicken
create or replace function public.notify_shift_changed()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.starts_at is distinct from old.starts_at or new.ends_at is distinct from old.ends_at then
    insert into public.notifications (user_id, title, body, link)
    select ss.user_id, 'Schicht geändert: ' || new.title,
           'Die Uhrzeit deiner Schicht wurde angepasst.', '/termine/' || new.event_id
    from public.shift_signups ss where ss.shift_id = new.id;

    update public.shift_signups set reminded_at = null where shift_id = new.id;
  end if;
  return new;
end;
$$;

revoke execute on function public.check_need_quantity() from public, anon;
revoke execute on function public.notify_shift_changed() from public, anon;
