-- ============================================================
-- WCP - Migration 028
-- Palpites de colocados finais (Campeao, Vice e 3o lugar)
-- ============================================================

ALTER TABLE public.pools
ADD COLUMN IF NOT EXISTS podium_predictions_cutoff_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS public.podium_predictions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pool_id UUID NOT NULL REFERENCES public.pools(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  champion_id UUID NOT NULL REFERENCES public.teams(id),
  vice_id UUID NOT NULL REFERENCES public.teams(id),
  third_id UUID NOT NULL REFERENCES public.teams(id),
  points INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (pool_id, user_id)
);

GRANT SELECT ON TABLE public.podium_predictions TO authenticated;
GRANT INSERT, UPDATE, DELETE ON TABLE public.podium_predictions TO authenticated;

CREATE OR REPLACE FUNCTION public.podium_predictions_deadline(p_pool_id UUID)
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

GRANT EXECUTE ON FUNCTION public.podium_predictions_deadline(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.is_team_in_pool(
  p_pool_id UUID,
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
      AND (m.home_team_id = p_team_id OR m.away_team_id = p_team_id)
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_team_in_pool(UUID, UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.validate_podium_prediction_teams()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.champion_id = NEW.vice_id OR NEW.champion_id = NEW.third_id OR NEW.vice_id = NEW.third_id THEN
    RAISE EXCEPTION 'Campeao, vice-campeao e 3o lugar devem ser times diferentes.';
  END IF;

  IF NOT public.is_team_in_pool(NEW.pool_id, NEW.champion_id) THEN
    RAISE EXCEPTION 'O time selecionado para campeao nao pertence ao bolao informado.';
  END IF;

  IF NOT public.is_team_in_pool(NEW.pool_id, NEW.vice_id) THEN
    RAISE EXCEPTION 'O time selecionado para vice-campeao nao pertence ao bolao informado.';
  END IF;

  IF NOT public.is_team_in_pool(NEW.pool_id, NEW.third_id) THEN
    RAISE EXCEPTION 'O time selecionado para 3o lugar nao pertence ao bolao informado.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS before_validate_podium_prediction_teams ON public.podium_predictions;
CREATE TRIGGER before_validate_podium_prediction_teams
  BEFORE INSERT OR UPDATE ON public.podium_predictions
  FOR EACH ROW
  EXECUTE PROCEDURE public.validate_podium_prediction_teams();

ALTER TABLE public.podium_predictions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pp_select_own" ON public.podium_predictions;
CREATE POLICY "pp_select_own" ON public.podium_predictions FOR SELECT USING (
  user_id = auth.uid()
);

DROP POLICY IF EXISTS "pp_others_select" ON public.podium_predictions;
CREATE POLICY "pp_others_select" ON public.podium_predictions FOR SELECT USING (
  EXISTS (
    SELECT 1
    FROM public.pool_members pm
    WHERE pm.pool_id = public.podium_predictions.pool_id
      AND pm.user_id = auth.uid()
  )
  AND public.podium_predictions_deadline(public.podium_predictions.pool_id) IS NOT NULL
  AND now() >= public.podium_predictions_deadline(public.podium_predictions.pool_id)
);

DROP POLICY IF EXISTS "pp_insert" ON public.podium_predictions;
CREATE POLICY "pp_insert" ON public.podium_predictions FOR INSERT WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.pool_members pm
    WHERE pm.pool_id = public.podium_predictions.pool_id
      AND pm.user_id = auth.uid()
  )
  AND public.podium_predictions_deadline(public.podium_predictions.pool_id) IS NOT NULL
  AND now() < public.podium_predictions_deadline(public.podium_predictions.pool_id)
);

DROP POLICY IF EXISTS "pp_update" ON public.podium_predictions;
CREATE POLICY "pp_update" ON public.podium_predictions FOR UPDATE
USING (
  user_id = auth.uid()
  AND public.podium_predictions_deadline(public.podium_predictions.pool_id) IS NOT NULL
  AND now() < public.podium_predictions_deadline(public.podium_predictions.pool_id)
)
WITH CHECK (
  user_id = auth.uid()
  AND public.podium_predictions_deadline(public.podium_predictions.pool_id) IS NOT NULL
  AND now() < public.podium_predictions_deadline(public.podium_predictions.pool_id)
);
