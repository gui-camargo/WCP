-- ============================================================
-- WCP – Migration 047
-- Histórico de ranking por partida (leaderboard snapshots)
--
-- O que faz:
--   1. Cria tabela leaderboard_snapshots (snapshot do ranking ao encerrar partida)
--   2. Cria função take_leaderboard_snapshot (preenche a tabela a partir da VIEW leaderboard)
--   3. Atualiza trigger trigger_recalculate_on_match_update para chamar o snapshot
--      na primeira transição para 'encerrado' (bloco isolado: falha nunca bloqueia a partida)
--   4. Cria RPC get_match_ranking_delta para consultar delta de posição por partida
--
-- Rollback: ver arquivo de plano em .claude/plans/
-- ============================================================

-- ==================== TABELA ====================
CREATE TABLE IF NOT EXISTS public.leaderboard_snapshots (
  id           UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  pool_id      UUID        NOT NULL REFERENCES public.pools(id)    ON DELETE CASCADE,
  match_id     UUID        NOT NULL REFERENCES public.matches(id)  ON DELETE CASCADE,
  user_id      UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  rank         INTEGER     NOT NULL,
  total_points INTEGER     NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (pool_id, match_id, user_id)
);

CREATE INDEX idx_lsnap_pool_user  ON public.leaderboard_snapshots (pool_id, user_id);
CREATE INDEX idx_lsnap_pool_match ON public.leaderboard_snapshots (pool_id, match_id);
CREATE INDEX idx_lsnap_created_at ON public.leaderboard_snapshots (created_at);

ALTER TABLE public.leaderboard_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lsnap_select" ON public.leaderboard_snapshots
  FOR SELECT USING (auth.role() = 'authenticated');

-- Sem INSERT/UPDATE/DELETE para authenticated — só funções SECURITY DEFINER escrevem aqui
GRANT SELECT ON TABLE public.leaderboard_snapshots TO authenticated;

-- ==================== FUNÇÃO: tirar snapshot ====================
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
  ON CONFLICT (pool_id, match_id, user_id) DO NOTHING;
END;
$$;

GRANT EXECUTE ON FUNCTION public.take_leaderboard_snapshot(UUID) TO authenticated;

-- ==================== TRIGGER: atualizado para chamar snapshot ====================
-- Mantém exatamente o mesmo comportamento da migration 026, apenas adiciona
-- a chamada de snapshot no primeiro encerramento da partida.
-- O bloco BEGIN/EXCEPTION garante que falha no snapshot NUNCA impede o resultado.
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

    IF NEW.status = 'encerrado' AND OLD.status <> 'encerrado' THEN
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

-- ==================== RPC: delta de ranking por partida ====================
-- Retorna para cada participante:
--   rank_after     = posição após essa partida
--   rank_before    = posição antes dessa partida (snapshot mais recente anterior)
--   position_delta = rank_before - rank_after  (positivo = subiu, negativo = desceu)
--   NULL delta     = primeira partida encerrada (sem snapshot anterior)
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
    SELECT ls.user_id, ls.rank AS rank_after, ls.created_at
    FROM public.leaderboard_snapshots ls
    WHERE ls.match_id = p_match_id
  ),
  snap_before AS (
    SELECT DISTINCT ON (ls.user_id)
      ls.user_id,
      ls.rank AS rank_before
    FROM public.leaderboard_snapshots ls
    WHERE ls.pool_id = (
      SELECT r.pool_id FROM public.matches m
      JOIN public.rounds r ON r.id = m.round_id
      WHERE m.id = p_match_id
    )
    AND ls.created_at < (
      SELECT MIN(sa2.created_at) FROM public.leaderboard_snapshots sa2
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
