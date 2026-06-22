-- ============================================================
-- Debug: Check if cutoff_at is being stored with timezone
-- ============================================================

-- This query shows the actual cutoff times to verify they're in the correct timezone
-- Run this in the Supabase SQL Editor to verify cutoff times are correct:
-- SELECT id, kickoff_at, cutoff_at, now() as server_now,
--        cutoff_at < now() as cutoff_passed
-- FROM public.matches
-- WHERE cutoff_at IS NOT NULL
-- LIMIT 10;

-- If cutoff_passed is showing FALSE when it should be TRUE, the issue is with timezone handling
-- To fix, update the policy to use AT TIME ZONE:

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
