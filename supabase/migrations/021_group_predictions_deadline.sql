-- ============================================================
-- WCP - Migration 021
-- Group predictions deadline + stronger validation
-- ============================================================

ALTER TABLE public.pools
ADD COLUMN IF NOT EXISTS group_predictions_cutoff_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION public.group_predictions_deadline(p_pool_id UUID)
RETURNS TIMESTAMPTZ
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT p.group_predictions_cutoff_at FROM public.pools p WHERE p.id = p_pool_id),
    (
      SELECT MIN(m.cutoff_at)
      FROM public.matches m
      JOIN public.rounds r ON r.id = m.round_id
      WHERE r.pool_id = p_pool_id
        AND r.phase = 'grupos'
    )
  );
$$;

GRANT EXECUTE ON FUNCTION public.group_predictions_deadline(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.is_team_in_pool_group(
  p_pool_id UUID,
  p_group_id UUID,
  p_team_id UUID
)
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
    WHERE r.pool_id = p_pool_id
      AND r.phase = 'grupos'
      AND m.group_id = p_group_id
      AND (m.home_team_id = p_team_id OR m.away_team_id = p_team_id)
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_team_in_pool_group(UUID, UUID, UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.validate_group_prediction_teams()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.first_id = NEW.second_id THEN
    RAISE EXCEPTION 'Primeiro e segundo colocados devem ser times diferentes.';
  END IF;

  IF NOT public.is_team_in_pool_group(NEW.pool_id, NEW.group_id, NEW.first_id) THEN
    RAISE EXCEPTION 'O time selecionado para 1o lugar nao pertence ao grupo informado.';
  END IF;

  IF NOT public.is_team_in_pool_group(NEW.pool_id, NEW.group_id, NEW.second_id) THEN
    RAISE EXCEPTION 'O time selecionado para 2o lugar nao pertence ao grupo informado.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS before_validate_group_prediction_teams ON public.group_predictions;
CREATE TRIGGER before_validate_group_prediction_teams
  BEFORE INSERT OR UPDATE ON public.group_predictions
  FOR EACH ROW
  EXECUTE PROCEDURE public.validate_group_prediction_teams();

DROP POLICY IF EXISTS "gp_others_select" ON public.group_predictions;
CREATE POLICY "gp_others_select" ON public.group_predictions FOR SELECT USING (
  EXISTS (
    SELECT 1
    FROM public.pool_members pm
    WHERE pm.pool_id = public.group_predictions.pool_id
      AND pm.user_id = auth.uid()
  )
  AND public.group_predictions_deadline(public.group_predictions.pool_id) IS NOT NULL
  AND now() >= public.group_predictions_deadline(public.group_predictions.pool_id)
);

DROP POLICY IF EXISTS "gp_insert" ON public.group_predictions;
CREATE POLICY "gp_insert" ON public.group_predictions FOR INSERT WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.pool_members pm
    WHERE pm.pool_id = public.group_predictions.pool_id
      AND pm.user_id = auth.uid()
  )
  AND public.group_predictions_deadline(public.group_predictions.pool_id) IS NOT NULL
  AND now() < public.group_predictions_deadline(public.group_predictions.pool_id)
);

DROP POLICY IF EXISTS "gp_update" ON public.group_predictions;
CREATE POLICY "gp_update" ON public.group_predictions FOR UPDATE
USING (
  user_id = auth.uid()
  AND public.group_predictions_deadline(public.group_predictions.pool_id) IS NOT NULL
  AND now() < public.group_predictions_deadline(public.group_predictions.pool_id)
)
WITH CHECK (
  user_id = auth.uid()
  AND public.group_predictions_deadline(public.group_predictions.pool_id) IS NOT NULL
  AND now() < public.group_predictions_deadline(public.group_predictions.pool_id)
);
