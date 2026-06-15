-- ============================================================================
-- CROWN AWARDS PARITY — let the Crown sweep write shareable vault_awards rows.
-- Run ONCE in Supabase SQL editor. Idempotent. Order matters: constraints are
-- WIDENED before any crown row can be inserted, or every insert is rejected.
--
-- Only ADDS allowed values — every existing value is preserved. Legacy rows
-- and the public /award/ page are untouched (public-read policies unchanged).
--
-- New values introduced (and nothing else):
--   activity_type : + 'pullups'
--   award_type    : + 'treble_weekly_win', 'treble_monthly_win'
--   source_type   : + 'crown'
-- (single crowns reuse weekly_win/monthly_win; doubles reuse double_*_win)
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. WIDEN CHECK CONSTRAINTS (introspect existing constraint by name, drop,
--    re-add widened). Each block is a no-op if already widened.
-- ---------------------------------------------------------------------------

-- activity_type: + pullups
do $$
declare old_name text;
begin
  if exists (
    select 1 from pg_constraint
    where conrelid = 'public.vault_awards'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%activity_type%'
      and pg_get_constraintdef(oid) ilike '%pullups%'
  ) then
    raise notice 'activity_type already allows pullups; skipping.';
  else
    select conname into old_name from pg_constraint
    where conrelid = 'public.vault_awards'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%activity_type%'
      and pg_get_constraintdef(oid) ilike '%pressups%';

    if old_name is not null then
      execute format('alter table public.vault_awards drop constraint %I', old_name);
    end if;

    alter table public.vault_awards
      add constraint vault_awards_activity_type_check
      check (activity_type = any (array['pressups', 'pullups', 'km', 'combined']));
    raise notice 'activity_type widened to include pullups.';
  end if;
end $$;

-- award_type: + treble_weekly_win, treble_monthly_win
do $$
declare old_name text;
begin
  if exists (
    select 1 from pg_constraint
    where conrelid = 'public.vault_awards'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%award_type%'
      and pg_get_constraintdef(oid) ilike '%treble%'
  ) then
    raise notice 'award_type already allows treble; skipping.';
  else
    select conname into old_name from pg_constraint
    where conrelid = 'public.vault_awards'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%award_type%'
      and pg_get_constraintdef(oid) ilike '%weekly_win%';

    if old_name is not null then
      execute format('alter table public.vault_awards drop constraint %I', old_name);
    end if;

    alter table public.vault_awards
      add constraint vault_awards_award_type_check
      check (award_type = any (array[
        'crown_taken', 'weekly_win', 'monthly_win',
        'double_weekly_win', 'double_monthly_win',
        'treble_weekly_win', 'treble_monthly_win',
        'vault_record_taken', 'personal_record'
      ]));
    raise notice 'award_type widened to include treble values.';
  end if;
end $$;

-- source_type: + crown (preserves NULL allowance)
do $$
declare old_name text;
begin
  if exists (
    select 1 from pg_constraint
    where conrelid = 'public.vault_awards'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%source_type%'
      and pg_get_constraintdef(oid) ilike '%crown%'
  ) then
    raise notice 'source_type already allows crown; skipping.';
  else
    select conname into old_name from pg_constraint
    where conrelid = 'public.vault_awards'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%source_type%'
      and pg_get_constraintdef(oid) ilike '%submission%';

    if old_name is not null then
      execute format('alter table public.vault_awards drop constraint %I', old_name);
    end if;

    alter table public.vault_awards
      add constraint vault_awards_source_type_check
      check (source_type is null or source_type = any (array[
        'submission', 'profile_record_entry', 'leaderboard', 'vault_record', 'crown'
      ]));
    raise notice 'source_type widened to include crown.';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 2. IDEMPOTENCY — one crown award per board/user/period. Partial index over
--    crown rows only, so it can never collide with legacy award rows. Created
--    AFTER source_type='crown' is permitted.
-- ---------------------------------------------------------------------------
create unique index if not exists vault_awards_crown_period_key
  on public.vault_awards (circle_id, user_id, period_type, period_start)
  where source_type = 'crown';

-- ---------------------------------------------------------------------------
-- 3. VERIFY (read-only)
-- ---------------------------------------------------------------------------
select 'crown awards parity ready' as status,
  (select count(*) from pg_constraint
    where conrelid = 'public.vault_awards'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%activity_type%'
      and pg_get_constraintdef(oid) ilike '%pullups%') as activity_ok,
  (select count(*) from pg_constraint
    where conrelid = 'public.vault_awards'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%award_type%'
      and pg_get_constraintdef(oid) ilike '%treble%') as award_ok,
  (select count(*) from pg_constraint
    where conrelid = 'public.vault_awards'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%source_type%'
      and pg_get_constraintdef(oid) ilike '%crown%') as source_ok;
-- Expected: all three = 1
