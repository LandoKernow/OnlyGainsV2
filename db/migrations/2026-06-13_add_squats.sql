-- ============================================================================
-- ONLY GAINS — ADD 'squats' (air squats) AS A LOGGED ACTIVITY TYPE
-- ----------------------------------------------------------------------------
-- Run ONCE in the Supabase SQL editor at (or just before) AIR SQUAT ASSAULT
-- launch. Mirrors 2026-06-11_add_pullups.sql exactly — same whitelist-patching
-- approach. Idempotent: re-running is harmless.
--
-- This is the "unlock squat logging" DB step. The app code already treats
-- squats as a full discipline (gated behind the event phase flag); this lets
-- the DB accept squat inserts + rank them.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- STEP 1 — CHECK constraints on activity_type columns
-- ----------------------------------------------------------------------------
do $$
declare
  con record;
begin
  for con in
    select c.oid, c.conname, c.conrelid::regclass::text as table_name
    from pg_constraint c
    where c.contype = 'c'
      and c.conrelid in ('public.submissions'::regclass, 'public.activity_events'::regclass)
      and pg_get_constraintdef(c.oid) ilike '%activity_type%'
      and pg_get_constraintdef(c.oid) ilike '%pressups%'
      and pg_get_constraintdef(c.oid) not ilike '%squats%'
  loop
    raise notice 'Patching CHECK constraint % on %', con.conname, con.table_name;
    execute format('alter table %s drop constraint %I', con.table_name, con.conname);
    execute format(
      'alter table %s add constraint %I check (activity_type in (''pressups'', ''pullups'', ''km'', ''squats''))',
      con.table_name, con.conname
    );
    raise notice 'CHECK constraint % now allows squats.', con.conname;
  end loop;
end $$;

-- ----------------------------------------------------------------------------
-- STEP 2 — Function whitelists (get_board_leaderboard, mirror trigger, etc.)
-- ----------------------------------------------------------------------------
do $$
declare
  fn record;
  def text;
  newdef text;
begin
  for fn in
    select p.oid, p.proname
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prokind = 'f'
      and pg_get_functiondef(p.oid) ilike '%pressups%'
      and pg_get_functiondef(p.oid) not ilike '%squats%'
  loop
    def := pg_get_functiondef(fn.oid);
    newdef := def;

    newdef := replace(newdef, '(''pressups'', ''pullups'', ''km'')', '(''pressups'', ''pullups'', ''km'', ''squats'')');
    newdef := replace(newdef, '(''pressups'',''pullups'',''km'')', '(''pressups'',''pullups'',''km'',''squats'')');
    newdef := replace(newdef, 'array[''pressups'', ''pullups'', ''km'']', 'array[''pressups'', ''pullups'', ''km'', ''squats'']');
    newdef := replace(newdef, 'array[''pressups'',''pullups'',''km'']', 'array[''pressups'',''pullups'',''km'',''squats'']');

    if newdef <> def then
      execute newdef;
      raise notice 'Function %: activity whitelist now includes squats.', fn.proname;
    elsif def ilike '%unsupported activity type%' or def ilike '%activity_type%' then
      raise notice 'Function %: mentions activity types but no known whitelist pattern — review manually with: select pg_get_functiondef(%L::regproc);',
        fn.proname, 'public.' || fn.proname;
    end if;
  end loop;
end $$;

-- ----------------------------------------------------------------------------
-- STEP 3 — VERIFY (read-only). Must succeed without "Unsupported activity type".
-- ----------------------------------------------------------------------------
select 'leaderboard rpc accepts squats' as check_name, count(*) as row_count
from public.get_board_leaderboard(
  'c769af17-6d63-41aa-8293-a4fd74d586f8'::uuid, -- Global Board
  'weekly',
  extract(year from now())::int,
  'squats'
);

select 'no remaining check constraints blocking squats' as check_name, count(*) as remaining
from pg_constraint c
where c.contype = 'c'
  and c.conrelid in ('public.submissions'::regclass, 'public.activity_events'::regclass)
  and pg_get_constraintdef(c.oid) ilike '%activity_type%'
  and pg_get_constraintdef(c.oid) ilike '%pressups%'
  and pg_get_constraintdef(c.oid) not ilike '%squats%';
-- Expected: remaining = 0
