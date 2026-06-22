-- ============================================================
-- WCP - Migration 046
-- Resultado real do podium (Campeao, Vice, 3o lugar)
-- e funcao de pontuacao dos palpites de podium
-- ============================================================

-- Tabela com o resultado oficial do podium por bolao
CREATE TABLE IF NOT EXISTS public.podium_standings (
  pool_id      UUID PRIMARY KEY REFERENCES public.pools(id) ON DELETE CASCADE,
  champion_id  UUID REFERENCES public.teams(id),
  vice_id      UUID REFERENCES public.teams(id),
  third_id     UUID REFERENCES public.teams(id)
);

GRANT SELECT ON TABLE public.podium_standings TO authenticated;
GRANT INSERT, UPDATE, DELETE ON TABLE public.podium_standings TO authenticated;

ALTER TABLE public.podium_standings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pst_select" ON public.podium_standings
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "pst_admin" ON public.podium_standings
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin)
  );

-- ==================== FUNÇÃO: pontuar palpite de podium ====================
-- Regras (max 20 pts):
--   Campeao exato:          10 pts
--   Vice-campeao exato:      6 pts
--   3o lugar exato:          4 pts
-- Requer podium_standings preenchido para o pool do palpite.
CREATE OR REPLACE FUNCTION public.calculate_podium_points(p_podium_prediction_id UUID)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pp public.podium_predictions%ROWTYPE;
  ps public.podium_standings%ROWTYPE;
  score INT := 0;
BEGIN
  SELECT * INTO pp FROM public.podium_predictions WHERE id = p_podium_prediction_id;
  SELECT * INTO ps FROM public.podium_standings   WHERE pool_id = pp.pool_id;

  IF ps.champion_id IS NULL THEN RETURN NULL; END IF;

  IF pp.champion_id = ps.champion_id THEN score := score + 10; END IF;
  IF pp.vice_id     = ps.vice_id     THEN score := score + 6;  END IF;
  IF pp.third_id    = ps.third_id    THEN score := score + 4;  END IF;

  RETURN score;
END;
$$;

GRANT EXECUTE ON FUNCTION public.calculate_podium_points(UUID) TO authenticated;

-- ==================== FUNÇÃO: recalcular pontos do podium ====================
CREATE OR REPLACE FUNCTION public.recalculate_podium_predictions_for_pool(p_pool_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.podium_predictions
  SET points = public.calculate_podium_points(id)
  WHERE pool_id = p_pool_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.recalculate_podium_predictions_for_pool(UUID) TO authenticated;
