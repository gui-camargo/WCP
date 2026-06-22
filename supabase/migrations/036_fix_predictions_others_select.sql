-- ============================================================
-- Fix predictions_others_select policy to properly allow viewing other users' predictions after cutoff
-- ============================================================

DROP POLICY IF EXISTS "predictions_others_select" ON public.predictions;

CREATE POLICY "predictions_others_select" ON public.predictions FOR SELECT USING (
  user_id != auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.matches m
    JOIN public.rounds r ON r.id = m.round_id
    JOIN public.pool_members pm ON pm.pool_id = r.pool_id
    WHERE m.id = predictions.match_id
      AND predictions.pool_id = pm.pool_id
      AND pm.user_id = auth.uid()
      AND m.cutoff_at < now()
  )
);
