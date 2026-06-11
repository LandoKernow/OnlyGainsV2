-- ============================================================================
-- ONLY GAINS — ADD 'pullups' AS A LOGGED ACTIVITY TYPE
-- ----------------------------------------------------------------------------
-- Run this ONCE in the Supabase SQL editor (Dashboard -> SQL Editor -> New
-- query -> paste -> Run). Read the NOTICE output at the bottom when it
-- finishes — it reports exactly what was changed and anything that needs a
-- manual look.
--
-- Why this is needed:
--   * submissions.activity_type is text, so inserts of 'pullups' may already
--     work — unless a CHECK constraint or the activity_events mirror trigger
--     whitelists ('pressups','km'). Step 1 and 2 handle both.
--   * get_board_leaderboard() rejects unknown types with "Unsupported
--     activity type" (verified 2026-06-11). Step 2 patches that whitelist.
--
-- The app is safe to deploy BEFORE this runs: pull-up leaderboards fall back
-- to the legacy submissions path automatically. But pull-up LOGGING needs the
-- whitelist patches if (and only if) the insert path enforces one — so run
-- this before announcing pull-ups.
--
-- Everything below is idempotent: re-running is harmless.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- STEP 1 — CHECK constraints on activity_type columns
-- Finds CHECK constraints on submissions / activity_events that allow
-- 'pressups' but not 'pullups', and recreates them with 'pullups' added.
-- The app only ever writes 'pressups', 'pullups', 'km'.
-- ----------------------------------------------------------------------------
do $$
declare
  con record;
  newdef text;
begin
  for con in
    select c.oid, c.conname, c.conrelid::regclass::text as table_name,
           pg_get_constraintdef(c.oid) as def
    from pg_constraint c
    where c.contype = 'c'
      and c.conrelid in ('public.submissions'::regclass, 'public.activity_events'::regclass)
      and pg_get_constraintdef(c.oid) ilike '%activity_type%'
      and pg_get_constraintdef(c.oid) ilike '%pressups%'
      and pg_get_constraintdef(c.oid) not ilike '%pullups%'
  loop
    raise notice 'Patching CHECK constraint % on % (was: %)', con.conname, con.table_name, con.def;
    execute format('alter table %s drop constraint %I', con.table_name, con.conname);
    execute format(
      'alter table %s add constraint %I check (activity_type in (''pressups'', ''pullups'', ''km''))',
      con.table_name, con.conname
    );
    raise notice 'CHECK constraint % now allows pullups.', con.conname;
  end loop;
end $$;


-- ----------------------------------------------------------------------------
-- STEP 2 — Function whitelists ('Unsupported activity type' and friends)
-- Scans every function in public (including the submissions->activity_events
-- mirror trigger function and get_board_leaderboard), and where the body
-- whitelists pressups/km without pullups, rewrites the list in place via
-- CREATE OR REPLACE using the function's own definition.
-- Only exact known patterns are replaced; anything unrecognised is reported
-- as a NOTICE for manual review instead of being touched.
-- ----------------------------------------------------------------------------
do $$
declare
  fn record;
  def text;
  newdef text;
  patched boolean;
begin
  for fn in
    select p.oid, p.proname
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prokind = 'f'
      and pg_get_functiondef(p.oid) ilike '%pressups%'
      and pg_get_functiondef(p.oid) not ilike '%pullups%'
  loop
    def := pg_get_functiondef(fn.oid);
    newdef := def;

    -- Common whitelist spellings. Each replace is a no-op if absent.
    newdef := replace(newdef, '(''pressups'', ''km'')', '(''pressups'', ''pullups'', ''km'')');
    newdef := replace(newdef, '(''pressups'',''km'')', '(''pressups'',''pullups'',''km'')');
    newdef := replace(newdef, '(''km'', ''pressups'')', '(''km'', ''pressups'', ''pullups'')');
    newdef := replace(newdef, '(''km'',''pressups'')', '(''km'',''pressups'',''pullups'')');
    newdef := replace(newdef, 'array[''pressups'', ''km'']', 'array[''pressups'', ''pullups'', ''km'']');
    newdef := replace(newdef, 'array[''pressups'',''km'']', 'array[''pressups'',''pullups'',''km'']');

    patched := newdef <> def;

    if patched then
      execute newdef;
      raise notice 'Function %: activity whitelist now includes pullups.', fn.proname;
    elsif def ilike '%unsupported activity type%'
       or def ilike '%activity_type%' then
      raise notice 'Function %: mentions activity types but no known whitelist pattern found — review manually with: select pg_get_functiondef(%L::regproc);',
        fn.proname, 'public.' || fn.proname;
    end if;
  end loop;
end $$;


-- ----------------------------------------------------------------------------
-- STEP 3 — VERIFY (read-only)
-- Both selects must succeed without "Unsupported activity type".
-- An empty result is fine — it just means nobody has logged pull-ups yet.
-- ----------------------------------------------------------------------------
select 'leaderboard rpc accepts pullups' as check_name, count(*) as row_count
from public.get_board_leaderboard(
  'c769af17-6d63-41aa-8293-a4fd74d586f8'::uuid, -- Global Board
  'weekly',
  extract(year from now())::int,
  'pullups'
);

select 'no remaining check constraints blocking pullups' as check_name, count(*) as remaining
from pg_constraint c
where c.contype = 'c'
  and c.conrelid in ('public.submissions'::regclass, 'public.activity_events'::regclass)
  and pg_get_constraintdef(c.oid) ilike '%activity_type%'
  and pg_get_constraintdef(c.oid) ilike '%pressups%'
  and pg_get_constraintdef(c.oid) not ilike '%pullups%';
-- Expected: remaining = 0


-- ----------------------------------------------------------------------------
-- OPTIONAL FOLLOW-UP (separate, not required for launch):
-- get_vault_app_tracked_records() computes record keys like
-- 'most_pressups_day'. If Step 2 reported it as patched, the Vault's
-- "Most pull-ups / day|week" cards will populate on their own. If it was
-- flagged for manual review, those two Vault cards simply stay on
-- "No holder yet" until the function is extended — nothing else is affected.
--
-- Awards finalisation (admin_finalize_period_awards_all) is intentionally
-- NOT touched here: awards stay press-ups + KM until you decide pull-ups
-- deserve their own crown. That is a product decision, not a bug.
-- ============================================================================
