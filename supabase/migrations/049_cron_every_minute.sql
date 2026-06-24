-- ============================================================
-- WCP – Migration 049
-- Increase cron frequency to every 1 minute
-- Reason: concurrent matches risk both closing in the same 3-min window
-- ============================================================

select cron.unschedule('sync-live-scores-tarde');
select cron.unschedule('sync-live-scores-noite');

select cron.schedule(
  'sync-live-scores-tarde',
  '* 16-23 * * *',
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
  '* 0-6 * * *',
  $$
  select net.http_post(
    url                  := 'https://pgqqkavyvhccgynzjfdc.supabase.co/functions/v1/sync-live-scores',
    headers              := '{"Authorization": "Bearer sb_publishable_pQUYs0chsfd7WUBZD5qC1g_Ag0q71lf", "Content-Type": "application/json"}'::jsonb,
    body                 := '{}'::jsonb,
    timeout_milliseconds := 30000
  )
  $$
);
