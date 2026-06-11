-- ============================================================================
-- ONLY GAINS — NOTIFICATION ENGINE OUTCOME LOG
-- Run once in Supabase SQL editor. Idempotent.
--
-- Every processed ping records its verdict here: events_created /
-- no_rank_change / suppressed / not_found / error (+detail). Written only by
-- the Worker (service role). Read via the Supabase dashboard table editor or
-- GET /api/events/log with the test-fire token. No client policies on purpose.
-- ============================================================================

create table if not exists public.notification_engine_log (
  id uuid primary key default gen_random_uuid(),
  submission_id text,
  outcome text not null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists notification_engine_log_created_idx
  on public.notification_engine_log (created_at desc);

alter table public.notification_engine_log enable row level security;
-- No policies: service role only.

select 'engine log ready' as status;
