-- =====================================================================
--  Web-Push-Abos + Admin-Walkthrough
-- =====================================================================

-- Ein Eintrag pro Gerät/Browser, auf dem Push aktiviert wurde
create table public.push_subscriptions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles (id) on delete cascade,
  endpoint        text not null unique,
  p256dh          text not null,
  auth            text not null,
  user_agent      text,
  created_at      timestamptz not null default now(),
  last_success_at timestamptz
);
create index push_subscriptions_user_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

-- Lesen/Löschen nur eigene; Anlegen/Senden läuft serverseitig mit Secret Key
create policy "push_subscriptions: eigene lesen" on public.push_subscriptions
  for select to authenticated using (user_id = auth.uid());
create policy "push_subscriptions: eigene löschen" on public.push_subscriptions
  for delete to authenticated using (user_id = auth.uid());

revoke all on public.push_subscriptions from anon;
grant select, delete on public.push_subscriptions to authenticated;
grant all on public.push_subscriptions to service_role;

-- Welche Benachrichtigungen schon als Push verschickt wurden
alter table public.notifications add column pushed_at timestamptz;
update public.notifications set pushed_at = now() where pushed_at is null;
create index notifications_unpushed_idx on public.notifications (created_at) where pushed_at is null;

-- Admin-Walkthrough nur beim ersten Mal automatisch zeigen
alter table public.profiles add column admin_tour_done_at timestamptz;
