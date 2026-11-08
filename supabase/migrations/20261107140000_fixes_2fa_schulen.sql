-- =====================================================================
--  1) Fehler: Schul-Policies verglichen cohorts.id statt schools.id
--     (unqualifiziertes "id" im Unterabfrage-Scope) → Schulname unsichtbar/nicht änderbar
--  2) 2FA serverseitig erzwingen: Wer einen verifizierten 2FA-Faktor hat, bekommt ohne
--     aal2-Sitzung keinerlei Daten – unabhängig davon, was im Cookie steht.
-- =====================================================================

drop policy "schools: eigene" on public.schools;
drop policy "schools: Admins bearbeiten" on public.schools;

create policy "schools: eigene" on public.schools
  for select to authenticated
  using (
    exists (select 1 from public.cohorts c where c.school_id = schools.id and c.id = public.my_cohort_id())
    or public.is_platform_admin()
  );
create policy "schools: Admins bearbeiten" on public.schools
  for update to authenticated
  using (public.is_admin() and exists (select 1 from public.cohorts c where c.school_id = schools.id and c.id = public.my_cohort_id()))
  with check (public.is_admin() and exists (select 1 from public.cohorts c where c.school_id = schools.id and c.id = public.my_cohort_id()));

-- Hat die angemeldete Person einen bestätigten 2FA-Faktor? (verlässliche Quelle statt Cookie)
create function public.my_mfa_enabled()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from auth.mfa_factors where user_id = auth.uid() and status = 'verified');
$$;

-- Ohne bestätigten Code (aal2) gibt es für 2FA-Nutzer keinen Jahrgang → keine Daten
create or replace function public.my_cohort_id()
returns uuid language sql stable security definer set search_path = '' as $$
  select p.cohort_id
  from public.profiles p
  join public.cohorts c on c.id = p.cohort_id
  where p.id = auth.uid() and c.active and not c.pending
    and (
      coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
      or not exists (select 1 from auth.mfa_factors f where f.user_id = auth.uid() and f.status = 'verified')
    );
$$;

-- Admin-Rechte ebenfalls nur mit gültigem Jahrgang (und damit ggf. 2FA)
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select public.my_cohort_id() is not null and exists (
    select 1 from public.profiles p join public.cohorts c on c.id = p.cohort_id
    where p.id = auth.uid() and p.role = 'admin'
      and (not c.require_admin_2fa or coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2')
  );
$$;

-- Orga-Team-Rechte auch nur mit gültigem Jahrgang
create or replace function public.is_organizer(p_event_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.my_cohort_id() is not null and exists (
    select 1 from public.event_organizers where event_id = p_event_id and user_id = auth.uid()
  );
$$;

-- Eigene Benachrichtigungen & Push-Abos ebenfalls nur mit gültiger Sitzung
drop policy "notifications: eigene lesen" on public.notifications;
drop policy "notifications: eigene markieren" on public.notifications;
drop policy "notifications: eigene löschen" on public.notifications;
create policy "notifications: eigene lesen" on public.notifications
  for select to authenticated using (user_id = auth.uid() and public.is_member());
create policy "notifications: eigene markieren" on public.notifications
  for update to authenticated using (user_id = auth.uid() and public.is_member()) with check (user_id = auth.uid());
create policy "notifications: eigene löschen" on public.notifications
  for delete to authenticated using (user_id = auth.uid() and public.is_member());

drop policy "push_subscriptions: eigene lesen" on public.push_subscriptions;
drop policy "push_subscriptions: eigene löschen" on public.push_subscriptions;
create policy "push_subscriptions: eigene lesen" on public.push_subscriptions
  for select to authenticated using (user_id = auth.uid() and public.is_member());
create policy "push_subscriptions: eigene löschen" on public.push_subscriptions
  for delete to authenticated using (user_id = auth.uid() and public.is_member());

revoke execute on function public.my_mfa_enabled() from public, anon;
grant execute on function public.my_mfa_enabled() to authenticated, service_role;
