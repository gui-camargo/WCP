-- ============================================================
-- WCP – Migration 057
-- Corrige get_match_ranking_delta para usar created_at em vez
-- de kickoff_at no snap_before.
--
-- Problema raiz: a versão anterior joinava leaderboard_snapshots
-- com matches via ls.match_id e filtrava por m.kickoff_at < kickoff
-- do jogo atual. Isso causava dois bugs:
--
--   1. Snapshots de grupo (match_id = NULL) eram excluídos pelo
--      JOIN → o bônus de grupo não era refletido no snap_before,
--      e a posição "antes" ignorava o efeito do encerramento do grupo.
--
--   2. Partidas simultâneas (mesmo kickoff_at) ficavam fora do
--      snap_before entre si → o segundo jogo de um par simultâneo
--      sempre via o estado de antes dos dois, nunca o estado
--      intermediário (após o primeiro do par fechar).
--
-- Fix: substituir toda a lógica de snap_before para usar
-- ls.created_at (ordem estrita da timeline reconstruída por
-- rebuild_leaderboard_timeline). O cutoff é o MIN(created_at)
-- dos snapshots do jogo alvo — que é único e monotônico graças
-- ao ts + seq*1ms aplicado na reconstrução.
-- ============================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.get_match_ranking_delta(p_match_id UUID)
RETURNS TABLE (
  user_id        UUID,
  rank_after     INTEGER,
  rank_before    INTEGER,
  position_delta INTEGER
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH snap_after AS (
    SELECT ls.user_id, ls.rank AS rank_after
    FROM public.leaderboard_snapshots ls
    WHERE ls.match_id = p_match_id
  ),
  snap_before AS (
    -- Evento imediatamente anterior na timeline (qualquer tipo: partida ou grupo).
    -- Usa created_at, que é monotônico por construção (ts + seq*1ms no rebuild).
    -- NÃO faz JOIN com matches para que snapshots de grupo (match_id NULL)
    -- também sejam considerados.
    SELECT DISTINCT ON (ls.user_id)
      ls.user_id,
      ls.rank AS rank_before
    FROM public.leaderboard_snapshots ls
    WHERE ls.pool_id = (
      SELECT r.pool_id
      FROM public.matches m
      JOIN public.rounds r ON r.id = m.round_id
      WHERE m.id = p_match_id
    )
    AND ls.created_at < (
      SELECT MIN(sa2.created_at)
      FROM public.leaderboard_snapshots sa2
      WHERE sa2.match_id = p_match_id
    )
    ORDER BY ls.user_id, ls.created_at DESC
  )
  SELECT
    sa.user_id,
    sa.rank_after,
    sb.rank_before,
    (sb.rank_before - sa.rank_after) AS position_delta
  FROM snap_after sa
  LEFT JOIN snap_before sb ON sb.user_id = sa.user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_match_ranking_delta(UUID) TO authenticated;

COMMIT;
