-- ============================================================
-- WCP – Migration 050
-- Corrige take_leaderboard_snapshot para atualizar snapshots
-- existentes quando uma partida é re-encerrada após correção.
--
-- Problema: ON CONFLICT DO NOTHING preservava o snapshot errado
-- quando o admin reabrida e re-encerrava uma partida com placar
-- corrigido. O trigger dispara corretamente (OLD.status = 'pendente'
-- → NEW.status = 'encerrado'), mas o conflito era ignorado.
--
-- Correção: ON CONFLICT DO UPDATE atualiza rank e total_points
-- sem alterar created_at (preserva ordenação cronológica usada
-- por get_match_ranking_delta).
-- ============================================================

CREATE OR REPLACE FUNCTION public.take_leaderboard_snapshot(p_match_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pool_id UUID;
BEGIN
  SELECT r.pool_id INTO v_pool_id
  FROM public.matches m
  JOIN public.rounds r ON r.id = m.round_id
  WHERE m.id = p_match_id;

  IF v_pool_id IS NULL THEN RETURN; END IF;

  INSERT INTO public.leaderboard_snapshots (pool_id, match_id, user_id, rank, total_points)
  SELECT lb.pool_id, p_match_id, lb.user_id, lb.rank::INTEGER, lb.total_points
  FROM public.leaderboard lb
  WHERE lb.pool_id = v_pool_id
  ON CONFLICT (pool_id, match_id, user_id) DO UPDATE
    SET rank         = EXCLUDED.rank,
        total_points = EXCLUDED.total_points;
  -- created_at NÃO é atualizado: preserva ordenação cronológica
  -- usada em get_match_ranking_delta para calcular snap_before.
END;
$$;

GRANT EXECUTE ON FUNCTION public.take_leaderboard_snapshot(UUID) TO authenticated;
