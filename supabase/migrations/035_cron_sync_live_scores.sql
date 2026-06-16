-- ============================================================
-- WCP – Migration 035
-- pg_cron job: sync live scores every 3 minutes
-- Requires pg_cron and pg_net extensions enabled in Supabase dashboard
-- ============================================================

select cron.schedule(
  'sync-live-scores',
  '*/3 * * * *',
  $$
  select net.http_post(
    url     := 'https://pgqqkavyvhccgynzjfdc.supabase.co/functions/v1/sync-live-scores',
    headers := '{"Authorization": "Bearer sb_publishable_pQUYs0chsfd7WUBZD5qC1g_Ag0q71lf", "Content-Type": "application/json"}'::jsonb,
    body    := '{}'::jsonb
  )
  $$
);
