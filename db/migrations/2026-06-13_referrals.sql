-- ============================================================================
-- REFERRAL / RECRUITER LOOP — schema
-- Run once in Supabase SQL editor. Idempotent. Review notes per block below.
--
-- Adds:
--   profiles.referral_code   — short, unique, human-shareable code (7 chars,
--                              unambiguous alphabet). Auto-assigned to new
--                              profiles via trigger; backfilled for all
--                              existing users so veterans can recruit at launch.
--   referrals                — recruit_id (PK, set-once) -> recruiter_id.
--   claim_referral(code)     — SECURITY DEFINER RPC enforcing every edge rule.
--
-- Writes to referrals happen ONLY through claim_referral (or service role).
-- Nothing here touches the logging write path.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. referral_code column + generator (unambiguous: no 0/O/1/I/L)
-- ---------------------------------------------------------------------------
alter table public.profiles add column if not exists referral_code text;

create or replace function public.gen_referral_code(len int default 7)
returns text language plpgsql as $$
declare
  alphabet text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  result text := '';
  i int;
begin
  for i in 1..len loop
    result := result || substr(alphabet, floor(random() * length(alphabet))::int + 1, 1);
  end loop;
  return result;
end;
$$;

create unique index if not exists profiles_referral_code_key
  on public.profiles (referral_code);

-- Assign a unique code on insert when one isn't supplied (retry on collision).
create or replace function public.assign_referral_code()
returns trigger language plpgsql as $$
declare
  candidate text;
begin
  if new.referral_code is not null then
    return new;
  end if;

  loop
    candidate := public.gen_referral_code(7);
    exit when not exists (select 1 from public.profiles where referral_code = candidate);
  end loop;

  new.referral_code := candidate;
  return new;
end;
$$;

drop trigger if exists profiles_assign_referral_code on public.profiles;
create trigger profiles_assign_referral_code
  before insert on public.profiles
  for each row execute function public.assign_referral_code();

-- Backfill every existing profile (veterans included).
do $$
declare
  r record;
  candidate text;
begin
  for r in select id from public.profiles where referral_code is null loop
    loop
      candidate := public.gen_referral_code(7);
      exit when not exists (select 1 from public.profiles where referral_code = candidate);
    end loop;
    update public.profiles set referral_code = candidate where id = r.id;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 2. referrals table — recruit -> recruiter, set-once
-- ---------------------------------------------------------------------------
create table if not exists public.referrals (
  recruit_id uuid primary key references auth.users (id) on delete cascade,
  recruiter_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists referrals_recruiter_idx on public.referrals (recruiter_id);

alter table public.referrals enable row level security;

-- Recruit may read their own attribution; recruiter may read (count) their
-- recruits. No write policies: only claim_referral / service role writes.
drop policy if exists "recruit reads own referral" on public.referrals;
create policy "recruit reads own referral" on public.referrals
  for select using (auth.uid() = recruit_id);

drop policy if exists "recruiter reads own recruits" on public.referrals;
create policy "recruiter reads own recruits" on public.referrals
  for select using (auth.uid() = recruiter_id);

-- ---------------------------------------------------------------------------
-- 3. claim_referral(code) — all edge rules enforced server-side
--    Returns: 'claimed' | 'noop' | 'invalid' | 'self' | 'veteran'
-- ---------------------------------------------------------------------------
create or replace function public.claim_referral(p_code text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_recruit uuid := auth.uid();
  v_recruiter uuid;
  v_inserted int := 0;
begin
  if v_recruit is null then
    return 'invalid';
  end if;

  -- Malformed / unknown code -> ignore, no row.
  select id into v_recruiter
  from public.profiles
  where referral_code = upper(trim(coalesce(p_code, '')));

  if v_recruiter is null then
    return 'invalid';
  end if;

  -- Self-referral (same account).
  if v_recruiter = v_recruit then
    return 'self';
  end if;

  -- Veteran gate: an account that existed at deploy can't be "recruited".
  if exists (select 1 from public.first_blood_exempt where user_id = v_recruit) then
    return 'veteran';
  end if;

  -- Set-once: first valid claim wins; a second recruiter's link is a no-op.
  insert into public.referrals (recruit_id, recruiter_id)
  values (v_recruit, v_recruiter)
  on conflict (recruit_id) do nothing;

  get diagnostics v_inserted = row_count;

  if v_inserted > 0 then
    return 'claimed';
  end if;

  return 'noop';
end;
$$;

grant execute on function public.claim_referral(text) to authenticated;

-- VERIFY
select
  'referral loop ready' as status,
  (select count(*) from public.profiles where referral_code is not null) as codes_assigned,
  (select count(*) from public.profiles) as total_profiles,
  (select count(*) from public.referrals) as referrals_so_far;
