-- ============================================================================
-- ONLY GAINS — EVENT OPT-IN LIST ("ANSWER THE CALL")
-- Run ONCE in the Supabase SQL editor THIS WEEK (during the tease) so the
-- opt-in list captures as warriors tap ANSWER THE CALL. The launch broadcast
-- Monday targets ONLY this list. Idempotent.
--
-- One row per warrior per event. The client inserts its own row (RLS); the
-- Worker (service role) reads the whole list to broadcast.
-- ============================================================================

create table if not exists public.event_optins (
  user_id uuid not null,
  event_key text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, event_key)
);

create index if not exists event_optins_event_idx on public.event_optins (event_key);

alter table public.event_optins enable row level security;

-- A warrior may record + read their OWN opt-in. No update/delete needed.
drop policy if exists "insert own optin" on public.event_optins;
create policy "insert own optin" on public.event_optins
  for insert with check (auth.uid() = user_id);

drop policy if exists "read own optin" on public.event_optins;
create policy "read own optin" on public.event_optins
  for select using (auth.uid() = user_id);

-- VERIFY
select 'event optins ready' as status,
  (select count(*) from public.event_optins) as optins_so_far;
