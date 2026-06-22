-- ============================================================
-- Simplify predictions SELECT policies - combine into one that handles both own and others
-- ============================================================

DROP POLICY IF EXISTS "predictions_own_select" ON public.predictions;
DROP POLICY IF EXISTS "predictions_others_select" ON public.predictions;

-- Single policy: allow viewing own predictions, and others' after cutoff
CREATE POLICY "predictions_select" ON public.predictions FOR SELECT USING (
  -- Allow viewing own predictions
  user_id = auth.uid()
  OR
  -- Allow viewing others' predictions after cutoff
  (
    EXISTS (
      SELECT 1 FROM public.matches m
      JOIN public.rounds r ON r.id = m.round_id
      JOIN public.pool_members pm ON pm.pool_id = r.pool_id
      WHERE m.id = predictions.match_id
        AND predictions.pool_id = r.pool_id
        AND pm.user_id = auth.uid()
        AND m.cutoff_at < now()
    )
  )
);
