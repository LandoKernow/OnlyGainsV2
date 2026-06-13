-- ============================================================================
-- FIRST BLOOD — veteran exemption (one-time deploy cutoff)
-- Run once in Supabase SQL editor at ship time. Idempotent.
--
-- FIRST BLOOD is sacred to genuine first sessions. Every account that already
-- exists at deploy is marked exempt here, from auth.users (the authoritative
-- account list — NOT submission history, which must never gate this). Accounts
-- created AFTER this runs are not in the table and get their real once-ever
-- FIRST BLOOD on first qualifying log.
--
-- The exemption is a plain marker, never a notification_event, so it never
-- renders as an achievement. Worker (service role) reads it to gate the award;
-- the client reads its own row (RLS) to keep the instant takeover in step.
-- ============================================================================

create table if not exists public.first_blood_exempt (
  user_id uuid primary key,
  created_at timestamptz not null default now()
);

alter table public.first_blood_exempt enable row level security;

-- Client may read ONLY its own exemption (to suppress the instant takeover).
-- No insert/update/delete policy: only the service role (worker / this
-- migration) ever writes.
drop policy if exists "read own exemption" on public.first_blood_exempt;
create policy "read own exemption" on public.first_blood_exempt
  for select using (auth.uid() = user_id);

-- One-time backfill: every account that exists right now is a veteran.
insert into public.first_blood_exempt (user_id)
select id from auth.users
on conflict (user_id) do nothing;

-- VERIFY
select
  'first blood exemption ready' as status,
  (select count(*) from public.first_blood_exempt) as veterans_exempted,
  (select count(*) from auth.users) as total_accounts;
