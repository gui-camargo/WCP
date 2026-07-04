-- ============================================================
-- WCP – Migration 058
-- Corrige take_leaderboard_snapshot para disparar também quando
-- o placar muda enquanto o jogo já está 'encerrado'.
--
-- Problema: o ESPN às vezes marca um jogo como 'completed' antes
-- do apito final (ex.: ao marcar o gol nos acréscimos). O cron
-- fecha o jogo com o placar parcial. Minutos depois, quando o
-- jogo realmente termina, o cron atualiza home_score/away_score
-- mas o status já é 'encerrado'. recalculate_match_predictions
-- recalcula os pontos corretamente, mas a condição
--   NEW.status = 'encerrado' AND OLD.status <> 'encerrado'
-- não é satisfeita (OLD.status também é 'encerrado'), então o
-- snapshot fica com os pontos do placar parcial/errado.
--
-- Fix: estender a condição para também atualizar o snapshot
-- quando o placar muda enquanto o status já é 'encerrado'.
-- ============================================================

BEGIN;

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

    -- Dispara snapshot na primeira transição para 'encerrado' OU quando o
    -- placar é corrigido enquanto o jogo já está 'encerrado' (ex.: ESPN
    -- reporta placar parcial como final e corrige minutos depois).
    IF NEW.status = 'encerrado'
       AND (OLD.status <> 'encerrado'
            OR OLD.home_score IS DISTINCT FROM NEW.home_score
            OR OLD.away_score IS DISTINCT FROM NEW.away_score) THEN
      BEGIN
        PERFORM public.take_leaderboard_snapshot(NEW.id);
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'take_leaderboard_snapshot falhou para match %: %', NEW.id, SQLERRM;
      END;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

GRANT EXECUTE ON FUNCTION public.trigger_recalculate_on_match_update() TO authenticated;

COMMIT;
