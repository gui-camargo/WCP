-- ============================================================
-- Fix: pool_members_select policy caused infinite RLS recursion
-- ============================================================
-- Migration 041 replaced the SECURITY DEFINER function with a direct
-- subquery on pool_members inside the policy. PostgreSQL applies RLS
-- to that subquery too, causing infinite recursion and crashing any
-- query that touches the table.
-- Fix: restore the SECURITY DEFINER function so the inner lookup
-- bypasses RLS, breaking the cycle.

DROP POLICY IF EXISTS "pool_members_select" ON public.pool_members;

CREATE OR REPLACE FUNCTION public.current_user_pool_ids()
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT pool_id FROM public.pool_members WHERE user_id = auth.uid();
$$;

GRANT EXECUTE ON FUNCTION public.current_user_pool_ids() TO authenticated;

CREATE POLICY "pool_members_select" ON public.pool_members FOR SELECT USING (
  user_id = auth.uid()
  OR public.is_current_user_admin()
  OR pool_id IN (SELECT public.current_user_pool_ids())
);
