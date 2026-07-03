-- ============================================================================
-- ONLY GAINS — INACTIVITY CONSEQUENCE SYSTEM (FALLEN / THE WIPE)
-- Run ONCE in the Supabase SQL editor WHEN (not before) the owner approves
-- enabling the system. Idempotent. The app code ships with enabled=false and
-- no-ops without these tables anyway.
--
-- inactivity_state  — per-user clock state: active | fallen | wiped, warning
--                     stage, and the cycle key (last-active day) that re-arms
--                     warnings when the user logs.
-- wipe_quarantine   — soft-delete archive. Every row THE WIPE removes is
--                     copied here first (30-day retention), enabling the
--                     admin-only restore path. Hard-deleted after expiry.
-- ============================================================================

create table if not exists public.inactivity_state (
  user_id uuid primary key,
  status text not null default 'active' check (status in ('active', 'fallen', 'wiped')),
  last_warned_stage int not null default 0,
  cycle_key text, -- the effective last-active London day this cycle was computed from
  fallen_at timestamptz,
  wiped_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.inactivity_state enable row level security;

-- Everyone authenticated may READ states (the client filters FALLEN warriors
-- out of board displays, and shows the user their own FALLEN/RISEN state).
-- Writes: service role only (the Worker sweep).
drop policy if exists "read states" on public.inactivity_state;
create policy "read states" on public.inactivity_state
  for select using (auth.role() = 'authenticated');

-- ----------------------------------------------------------------------------

create table if not exists public.wipe_quarantine (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  source_table text not null,
  row_data jsonb not null,
  wiped_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create index if not exists wipe_quarantine_user_idx on public.wipe_quarantine (user_id);
create index if not exists wipe_quarantine_expiry_idx on public.wipe_quarantine (expires_at);

alter table public.wipe_quarantine enable row level security;
-- No policies on purpose: service role only. Users never see the quarantine.

-- VERIFY
select 'inactivity tables ready' as status,
  (select count(*) from public.inactivity_state) as states,
  (select count(*) from public.wipe_quarantine) as quarantined;
