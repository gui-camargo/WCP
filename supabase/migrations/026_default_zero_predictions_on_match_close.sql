-- ============================================================
-- WCP – Migration 026
-- Ao encerrar partida, cria palpites 0x0 para membros sem palpite
-- e recalcula pontos considerando todos os participantes.
-- ============================================================

CREATE OR REPLACE FUNCTION public.ensure_missing_predictions_with_zero(p_match_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pool_id UUID;
BEGIN
  SELECT r.pool_id
  INTO v_pool_id
  FROM public.matches m
  JOIN public.rounds r ON r.id = m.round_id
  WHERE m.id = p_match_id;

  IF v_pool_id IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.predictions (pool_id, match_id, user_id, home_guess, away_guess)
  SELECT v_pool_id, p_match_id, pm.user_id, 0, 0
  FROM public.pool_members pm
  WHERE pm.pool_id = v_pool_id
  ON CONFLICT (pool_id, match_id, user_id) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.trigger_recalculate_on_match_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.home_score IS DISTINCT FROM NEW.home_score
     OR OLD.away_score IS DISTINCT FROM NEW.away_score
     OR OLD.status IS DISTINCT FROM NEW.status THEN

    IF NEW.status = 'encerrado' THEN
      PERFORM public.ensure_missing_predictions_with_zero(NEW.id);
    END IF;

    PERFORM public.recalculate_match_predictions(NEW.id);
  END IF;

  RETURN NEW;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_missing_predictions_with_zero(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.trigger_recalculate_on_match_update() TO authenticated;
