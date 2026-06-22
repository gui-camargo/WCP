-- ============================================================
-- WCP – Migration 036
-- Restrict sync-live-scores cron to game hours only
-- Copa 2026 games run ~16:00–04:00 UTC (Americas timezones)
-- Two jobs needed because cron cannot wrap midnight in one expression
-- ============================================================

select cron.unschedule('sync-live-scores');

-- Afternoon/evening games: 16:00–23:59 UTC
select cron.schedule(
  'sync-live-scores-tarde',
  '*/3 16-23 * * *',
  $$
  select net.http_post(
    url     := 'https://pgqqkavyvhccgynzjfdc.supabase.co/functions/v1/sync-live-scores',
    headers := '{"Authorization": "Bearer sb_publishable_pQUYs0chsfd7WUBZD5qC1g_Ag0q71lf", "Content-Type": "application/json"}'::jsonb,
    body    := '{}'::jsonb
  )
  $$
);

-- Late-night games: 00:00–04:59 UTC
select cron.schedule(
  'sync-live-scores-noite',
  '*/3 0-4 * * *',
  $$
  select net.http_post(
    url     := 'https://pgqqkavyvhccgynzjfdc.supabase.co/functions/v1/sync-live-scores',
    headers := '{"Authorization": "Bearer sb_publishable_pQUYs0chsfd7WUBZD5qC1g_Ag0q71lf", "Content-Type": "application/json"}'::jsonb,
    body    := '{}'::jsonb
  )
  $$
);
