-- ============================================================
-- Fix: Predictions RLS policy cutoff timezone handling
-- ============================================================
-- Issue: The predictions_select policy (from 037) was comparing
-- cutoff_at < now() without timezone handling, which fails
-- when cutoff times are stored in different timezones.
-- Solution: Update policy to use explicit AT TIME ZONE 'UTC'

DROP POLICY IF EXISTS "predictions_select" ON public.predictions;

CREATE POLICY "predictions_select" ON public.predictions FOR SELECT USING (
  -- Allow viewing own predictions
  user_id = auth.uid()
  OR
  -- Allow viewing others' predictions after cutoff (with explicit timezone handling)
  (
    EXISTS (
      SELECT 1 FROM public.matches m
      JOIN public.rounds r ON r.id = m.round_id
      JOIN public.pool_members pm ON pm.pool_id = r.pool_id
      WHERE m.id = predictions.match_id
        AND predictions.pool_id = r.pool_id
        AND pm.user_id = auth.uid()
        AND m.cutoff_at AT TIME ZONE 'UTC' < now() AT TIME ZONE 'UTC'
    )
  )
);
