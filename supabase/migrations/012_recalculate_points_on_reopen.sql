-- ============================================================
-- WCP – Migration 012
-- Recalcula pontos em qualquer mudanca de status/placar da partida
-- (inclui reabertura de jogo encerrado)
-- ============================================================

CREATE OR REPLACE FUNCTION trigger_recalculate_on_match_update()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.home_score IS DISTINCT FROM NEW.home_score
     OR OLD.away_score IS DISTINCT FROM NEW.away_score
     OR OLD.status IS DISTINCT FROM NEW.status THEN
    PERFORM recalculate_match_predictions(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;
