-- ============================================================
-- WCP – Bolao Copa do Mundo
-- Migration 007 – Fix pools SELECT policy for owner visibility
-- Execute esta migration em bancos que ja aplicaram a 001
-- ============================================================

DROP POLICY IF EXISTS "pools_select" ON pools;

CREATE POLICY "pools_select" ON pools FOR SELECT USING (
  owner_id = auth.uid()
  OR EXISTS (SELECT 1 FROM pool_members WHERE pool_id = pools.id AND user_id = auth.uid())
);
