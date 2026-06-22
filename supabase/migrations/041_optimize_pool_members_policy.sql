-- ============================================================
-- Optimize: Pool members policy to avoid function call overhead
-- ============================================================
-- The is_current_user_pool_member_for_rls function was causing overhead.
-- Simplify by using a direct subquery instead.

DROP POLICY IF EXISTS "pool_members_select" ON public.pool_members;

DROP FUNCTION IF EXISTS public.is_current_user_pool_member_for_rls(UUID);

CREATE POLICY "pool_members_select" ON public.pool_members FOR SELECT USING (
  -- Own membership
  user_id = auth.uid()
  OR
  -- All members if I'm admin
  public.is_current_user_admin()
  OR
  -- All members of pools I'm part of (direct subquery)
  pool_id IN (
    SELECT pool_id FROM public.pool_members
    WHERE user_id = auth.uid()
  )
);
