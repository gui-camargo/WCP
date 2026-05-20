-- ============================================================
-- WCP – Migration 015
-- Match-level cutoff (2h before kickoff) + predictions policies by cutoff
-- ============================================================

ALTER TABLE public.matches
ADD COLUMN IF NOT EXISTS cutoff_at TIMESTAMPTZ;

UPDATE public.matches
SET cutoff_at = kickoff_at - INTERVAL '2 hour'
WHERE cutoff_at IS NULL;

ALTER TABLE public.matches
ALTER COLUMN cutoff_at SET NOT NULL;

CREATE OR REPLACE FUNCTION set_match_cutoff_on_write()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.cutoff_at IS NULL THEN
    NEW.cutoff_at := NEW.kickoff_at - INTERVAL '2 hour';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS before_match_set_cutoff ON public.matches;
CREATE TRIGGER before_match_set_cutoff
  BEFORE INSERT OR UPDATE OF kickoff_at, cutoff_at ON public.matches
  FOR EACH ROW EXECUTE PROCEDURE set_match_cutoff_on_write();

DROP POLICY IF EXISTS "predictions_others_select" ON public.predictions;
DROP POLICY IF EXISTS "predictions_insert" ON public.predictions;
DROP POLICY IF EXISTS "predictions_update" ON public.predictions;

CREATE POLICY "predictions_others_select" ON public.predictions FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.matches m
    JOIN public.rounds r ON r.id = m.round_id
    JOIN public.pool_members pm ON pm.pool_id = r.pool_id
    WHERE m.id = predictions.match_id
      AND pm.user_id = auth.uid()
      AND m.cutoff_at < now()
  )
);

CREATE POLICY "predictions_insert" ON public.predictions FOR INSERT WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.matches m
    JOIN public.rounds r ON r.id = m.round_id
    JOIN public.pool_members pm ON pm.pool_id = r.pool_id
    WHERE m.id = match_id
      AND pm.user_id = auth.uid()
      AND m.cutoff_at > now()
  )
);

CREATE POLICY "predictions_update" ON public.predictions FOR UPDATE USING (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.matches m
    WHERE m.id = match_id
      AND m.cutoff_at > now()
  )
);
