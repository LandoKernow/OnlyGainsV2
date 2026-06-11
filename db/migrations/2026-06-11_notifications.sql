-- ============================================================================
-- ONLY GAINS — NOTIFICATION ENGINE TABLES
-- Run once in Supabase SQL editor. Idempotent.
--
-- notification_events  — every "moment that matters", powers the in-app feed
-- push_subscriptions   — web-push endpoints per user/device
-- notification_prefs   — per-category toggles + global mute
--
-- Writes to notification_events come ONLY from the Cloudflare Worker using
-- the service-role key (bypasses RLS). Clients can read/mark-read their own.
-- ============================================================================

create table if not exists public.notification_events (
  id uuid primary key default gen_random_uuid(),
  recipient_user_id uuid not null,
  type text not null,
  priority text not null default 'medium', -- high | medium | low
  actor_user_id uuid,
  actor_name text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index if not exists notification_events_recipient_idx
  on public.notification_events (recipient_user_id, created_at desc);

create index if not exists notification_events_unread_idx
  on public.notification_events (recipient_user_id)
  where read_at is null;

alter table public.notification_events enable row level security;

drop policy if exists "read own events" on public.notification_events;
create policy "read own events" on public.notification_events
  for select using (auth.uid() = recipient_user_id);

drop policy if exists "mark own events read" on public.notification_events;
create policy "mark own events read" on public.notification_events
  for update using (auth.uid() = recipient_user_id)
  with check (auth.uid() = recipient_user_id);

-- ----------------------------------------------------------------------------

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  endpoint text not null unique,
  keys jsonb not null, -- { p256dh, auth }
  user_agent text,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

create index if not exists push_subscriptions_user_idx
  on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

drop policy if exists "manage own subscriptions" on public.push_subscriptions;
create policy "manage own subscriptions" on public.push_subscriptions
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ----------------------------------------------------------------------------

create table if not exists public.notification_prefs (
  user_id uuid primary key,
  global_mute boolean not null default false,
  categories jsonb not null default '{}'::jsonb, -- { chase: bool, board: bool, streak: bool, milestone: bool }
  updated_at timestamptz not null default now()
);

alter table public.notification_prefs enable row level security;

drop policy if exists "manage own prefs" on public.notification_prefs;
create policy "manage own prefs" on public.notification_prefs
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- VERIFY
select 'notification tables ready' as status,
  (select count(*) from public.notification_events) as events,
  (select count(*) from public.push_subscriptions) as subscriptions,
  (select count(*) from public.notification_prefs) as prefs;
