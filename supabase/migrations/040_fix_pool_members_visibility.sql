-- ============================================================
-- Fix: Pool members visibility for regular members
-- ============================================================
-- Issue: Pool members could only see themselves or all members if they were the pool owner.
-- Regular members couldn't see other members of the same pool.
-- Solution: Allow members to see all members of pools they belong to.

DROP POLICY IF EXISTS "pool_members_select" ON public.pool_members;

-- Use a security-definer function to avoid RLS recursion issues
CREATE OR REPLACE FUNCTION public.is_current_user_pool_member_for_rls(p_pool_id UUID)
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

GRANT EXECUTE ON FUNCTION public.is_current_user_pool_member_for_rls(UUID) TO authenticated;

CREATE POLICY "pool_members_select" ON public.pool_members FOR SELECT USING (
  -- Own membership
  user_id = auth.uid()
  OR
  -- All members if I'm admin
  public.is_current_user_admin()
  OR
  -- All members of pools I'm part of (using security definer function to avoid recursion)
  public.is_current_user_pool_member_for_rls(pool_id)
);
