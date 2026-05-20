-- ============================================================
-- WCP – Bolao Copa do Mundo
-- Migration 009 – Fix pool_members SELECT visibility for owner/admin
-- Execute esta migration em bancos que ja aplicaram a 001
-- ============================================================

DROP POLICY IF EXISTS "pool_members_select" ON pool_members;

CREATE POLICY "pool_members_select" ON pool_members FOR SELECT USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM pools p
    WHERE p.id = pool_members.pool_id
      AND p.owner_id = auth.uid()
  )
  OR public.is_current_user_admin()
);
