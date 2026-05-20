-- ============================================================
-- WCP – Migration 016
-- Remove rounds.deadline and migrate group_predictions policies
-- to match-level cutoff rules.
-- ============================================================

DROP POLICY IF EXISTS "gp_others_select" ON public.group_predictions;
DROP POLICY IF EXISTS "gp_update" ON public.group_predictions;

CREATE POLICY "gp_others_select" ON public.group_predictions FOR SELECT USING (
  EXISTS (
    SELECT 1
    FROM public.pool_members pm
    WHERE pm.pool_id = group_predictions.pool_id
      AND pm.user_id = auth.uid()
      AND EXISTS (
        SELECT 1
        FROM public.matches m
        JOIN public.rounds r ON r.id = m.round_id
        WHERE r.pool_id = group_predictions.pool_id
          AND m.cutoff_at < now()
        LIMIT 1
      )
  )
);

CREATE POLICY "gp_update" ON public.group_predictions FOR UPDATE USING (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.matches m
    JOIN public.rounds r ON r.id = m.round_id
    WHERE r.pool_id = group_predictions.pool_id
      AND m.cutoff_at > now()
    LIMIT 1
  )
);

ALTER TABLE public.rounds
DROP COLUMN IF EXISTS deadline;
