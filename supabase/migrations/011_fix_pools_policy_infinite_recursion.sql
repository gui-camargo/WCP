-- ============================================================
-- WCP – Bolao Copa do Mundo
-- Migration 011 – Fix infinite recursion in pools policy
-- Execute esta migration em bancos que ja aplicaram a 001
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_current_user_pool_member(p_pool_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.pool_members pm
    WHERE pm.pool_id = p_pool_id
      AND pm.user_id = auth.uid()
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_current_user_pool_member(UUID) TO authenticated;

DROP POLICY IF EXISTS "pools_select" ON public.pools;

CREATE POLICY "pools_select" ON public.pools FOR SELECT USING (
  owner_id = auth.uid()
  OR public.is_current_user_pool_member(public.pools.id)
  OR public.is_current_user_admin()
);
