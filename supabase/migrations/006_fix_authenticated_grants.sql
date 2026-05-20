-- ============================================================
-- WCP – Bolao Copa do Mundo
-- Migration 006 – Fix grants for authenticated role
-- Execute esta migration em bancos que ja aplicaram a 001
-- ============================================================

GRANT USAGE ON SCHEMA public TO anon, authenticated;

GRANT SELECT ON TABLE
  profiles,
  pools,
  pool_members,
  groups,
  teams,
  rounds,
  matches,
  predictions,
  group_predictions,
  group_standings,
  leaderboard
TO authenticated;

GRANT INSERT, UPDATE, DELETE ON TABLE
  pools,
  pool_members,
  rounds,
  matches,
  predictions,
  group_predictions,
  group_standings
TO authenticated;
