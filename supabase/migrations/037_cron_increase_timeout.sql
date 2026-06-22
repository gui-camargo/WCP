-- ============================================================
-- WCP – Migration 037
-- Increase pg_net timeout on sync-live-scores cron jobs
-- Default 5s was too short for Edge Function + external API call
-- ============================================================

select cron.unschedule('sync-live-scores-tarde');
select cron.unschedule('sync-live-scores-noite');

select cron.schedule(
  'sync-live-scores-tarde',
  '*/3 16-23 * * *',
  $$
  select net.http_post(
    url                  := 'https://pgqqkavyvhccgynzjfdc.supabase.co/functions/v1/sync-live-scores',
    headers              := '{"Authorization": "Bearer sb_publishable_pQUYs0chsfd7WUBZD5qC1g_Ag0q71lf", "Content-Type": "application/json"}'::jsonb,
    body                 := '{}'::jsonb,
    timeout_milliseconds := 30000
  )
  $$
);

select cron.schedule(
  'sync-live-scores-noite',
  '*/3 0-6 * * *',
  $$
  select net.http_post(
    url                  := 'https://pgqqkavyvhccgynzjfdc.supabase.co/functions/v1/sync-live-scores',
    headers              := '{"Authorization": "Bearer sb_publishable_pQUYs0chsfd7WUBZD5qC1g_Ag0q71lf", "Content-Type": "application/json"}'::jsonb,
    body                 := '{}'::jsonb,
    timeout_milliseconds := 30000
  )
  $$
);
