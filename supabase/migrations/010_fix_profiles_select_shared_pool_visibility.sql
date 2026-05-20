-- ============================================================
-- WCP – Bolao Copa do Mundo
-- Migration 010 – Fix profiles SELECT visibility for shared pool members
-- Execute esta migration em bancos que ja aplicaram a 001
-- ============================================================

DROP POLICY IF EXISTS "profiles_select" ON profiles;

CREATE POLICY "profiles_select" ON profiles FOR SELECT USING (
  auth.uid() = id
  OR public.is_current_user_admin()
  OR EXISTS (
    SELECT 1
    FROM pool_members pm_viewer
    JOIN pool_members pm_target ON pm_target.pool_id = pm_viewer.pool_id
    WHERE pm_viewer.user_id = auth.uid()
      AND pm_target.user_id = profiles.id
  )
);
