-- ============================================================
-- WCP – Migration 019
-- Security hardening for profiles, pool_members and predictions
-- ============================================================

-- -------------------- Helpers --------------------
CREATE OR REPLACE FUNCTION public.match_belongs_to_pool(p_match_id UUID, p_pool_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.matches m
    JOIN public.rounds r ON r.id = m.round_id
    WHERE m.id = p_match_id
      AND r.pool_id = p_pool_id
  );
$$;

GRANT EXECUTE ON FUNCTION public.match_belongs_to_pool(UUID, UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.is_profile_sensitive_fields_unchanged(
  p_profile_id UUID,
  p_email TEXT,
  p_is_admin BOOLEAN
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = p_profile_id
      AND p.email = p_email
      AND p.is_admin = p_is_admin
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_profile_sensitive_fields_unchanged(UUID, TEXT, BOOLEAN) TO authenticated;

-- -------------------- Grants --------------------
-- Profiles: authenticated users can only update non-sensitive fields.
REVOKE INSERT, UPDATE, DELETE ON public.profiles FROM authenticated;
GRANT UPDATE (name, active_pool_id) ON public.profiles TO authenticated;

-- Predictions: users must not update points/pool/match/user.
REVOKE UPDATE ON public.predictions FROM authenticated;
GRANT UPDATE (home_guess, away_guess) ON public.predictions TO authenticated;

-- Group predictions: users must not update points/pool/user/group.
REVOKE UPDATE ON public.group_predictions FROM authenticated;
GRANT UPDATE (first_id, second_id) ON public.group_predictions TO authenticated;

-- -------------------- Policies --------------------
DROP POLICY IF EXISTS "profiles_update" ON public.profiles;
CREATE POLICY "profiles_update" ON public.profiles
FOR UPDATE
USING (
  auth.uid() = id
)
WITH CHECK (
  auth.uid() = id
  AND public.is_profile_sensitive_fields_unchanged(id, email, is_admin)
);

DROP POLICY IF EXISTS "pool_members_insert" ON public.pool_members;
CREATE POLICY "pool_members_insert" ON public.pool_members
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.pools p
    WHERE p.id = pool_id
      AND p.owner_id = auth.uid()
  )
  OR public.is_current_user_admin()
);

DROP POLICY IF EXISTS "predictions_insert" ON public.predictions;
CREATE POLICY "predictions_insert" ON public.predictions
FOR INSERT
WITH CHECK (
  user_id = auth.uid()
  AND public.match_belongs_to_pool(match_id, pool_id)
  AND EXISTS (
    SELECT 1
    FROM public.matches m
    JOIN public.rounds r ON r.id = m.round_id
    JOIN public.pool_members pm ON pm.pool_id = r.pool_id
    WHERE m.id = match_id
      AND pm.user_id = auth.uid()
      AND m.cutoff_at > now()
  )
);

DROP POLICY IF EXISTS "predictions_update" ON public.predictions;
CREATE POLICY "predictions_update" ON public.predictions
FOR UPDATE
USING (
  user_id = auth.uid()
  AND public.match_belongs_to_pool(match_id, pool_id)
  AND EXISTS (
    SELECT 1
    FROM public.matches m
    WHERE m.id = match_id
      AND m.cutoff_at > now()
  )
)
WITH CHECK (
  user_id = auth.uid()
  AND public.match_belongs_to_pool(match_id, pool_id)
  AND EXISTS (
    SELECT 1
    FROM public.matches m
    WHERE m.id = match_id
      AND m.cutoff_at > now()
  )
);
