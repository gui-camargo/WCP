-- ============================================================
-- WCP – Migration 051
-- Fechamento de grupo como EVENTO na timeline de ranking
--
-- Problema: ao finalizar um grupo (recalculate_group_predictions_for_group),
-- o bônus entra no leaderboard ao vivo, mas nenhum snapshot é atualizado.
-- Resultado: posição/delta dos modais e da página de Estatística ficam errados.
--
-- Solução: a tabela leaderboard_snapshots passa a aceitar dois tipos de evento:
--   - partida encerrada (match_id)  — já existia
--   - grupo encerrado  (group_id)   — novo
-- Cada snapshot guarda o leaderboard CUMULATIVO no momento do evento; o delta é
-- sempre a diferença para o evento anterior da timeline.
--
-- Inclui:
--   1. Generaliza leaderboard_snapshots (group_id, match_id nullable, índices parciais)
--   2. Ajusta take_leaderboard_snapshot (ON CONFLICT no índice parcial)
--   3. take_group_close_snapshot (cria o evento de grupo a partir do leaderboard ao vivo)
--   4. recalculate_group_predictions_for_group chama o snapshot de grupo
--   5. rebuild_leaderboard_timeline (reconstrução cronológica completa)
--   6. Backfill de todos os pools
-- ============================================================

BEGIN;

-- ==================== 1. SCHEMA ====================
ALTER TABLE public.leaderboard_snapshots
  ALTER COLUMN match_id DROP NOT NULL;

ALTER TABLE public.leaderboard_snapshots
  ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE;

-- exatamente um tipo de evento por linha (ou match_id, ou group_id)
ALTER TABLE public.leaderboard_snapshots
  DROP CONSTRAINT IF EXISTS chk_lsnap_event_kind;
ALTER TABLE public.leaderboard_snapshots
  ADD CONSTRAINT chk_lsnap_event_kind CHECK (num_nonnulls(match_id, group_id) = 1);

-- substitui o UNIQUE (pool_id, match_id, user_id) por dois índices parciais
ALTER TABLE public.leaderboard_snapshots
  DROP CONSTRAINT IF EXISTS leaderboard_snapshots_pool_id_match_id_user_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS ux_lsnap_match
  ON public.leaderboard_snapshots (pool_id, match_id, user_id) WHERE match_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ux_lsnap_group
  ON public.leaderboard_snapshots (pool_id, group_id, user_id) WHERE group_id IS NOT NULL;

-- ==================== 2. take_leaderboard_snapshot (partida) ====================
-- Igual à 050, mas o ON CONFLICT aponta para o índice parcial novo.
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
  ON CONFLICT (pool_id, match_id, user_id) WHERE match_id IS NOT NULL DO UPDATE
    SET rank         = EXCLUDED.rank,
        total_points = EXCLUDED.total_points;
END;
$$;

GRANT EXECUTE ON FUNCTION public.take_leaderboard_snapshot(UUID) TO authenticated;

-- ==================== 3. take_group_close_snapshot (grupo) ====================
-- Grava o evento de fechamento de grupo a partir do leaderboard AO VIVO (já com o
-- bônus aplicado). Usado no going-forward (now()). created_at preservado em UPDATE.
CREATE OR REPLACE FUNCTION public.take_group_close_snapshot(
  p_group_id UUID,
  p_at TIMESTAMPTZ DEFAULT now()
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.leaderboard_snapshots (pool_id, group_id, user_id, rank, total_points, created_at)
  SELECT lb.pool_id, p_group_id, lb.user_id, lb.rank::INTEGER, lb.total_points, p_at
  FROM public.leaderboard lb
  WHERE lb.pool_id IN (
    SELECT DISTINCT gp.pool_id FROM public.group_predictions gp WHERE gp.group_id = p_group_id
  )
  ON CONFLICT (pool_id, group_id, user_id) WHERE group_id IS NOT NULL DO UPDATE
    SET rank         = EXCLUDED.rank,
        total_points = EXCLUDED.total_points;
  -- created_at NÃO é atualizado no conflito: preserva a posição na timeline.
END;
$$;

GRANT EXECUTE ON FUNCTION public.take_group_close_snapshot(UUID, TIMESTAMPTZ) TO authenticated;

-- ==================== 4. recalculate_group_predictions_for_group ====================
-- Após gravar os pontos de bônus, cria/atualiza o evento de fechamento do grupo.
CREATE OR REPLACE FUNCTION public.recalculate_group_predictions_for_group(p_group_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE group_predictions gp
  SET points = calculate_group_bonus_points(gp.id)
  WHERE gp.group_id = p_group_id;

  PERFORM public.take_group_close_snapshot(p_group_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.recalculate_group_predictions_for_group(UUID) TO authenticated;

-- ==================== 5. rebuild_leaderboard_timeline ====================
-- Reconstrói TODA a timeline (partidas + grupos) de um pool, em ordem cronológica,
-- cada snapshot guardando o leaderboard cumulativo "como estava naquele momento".
--   - ts de partida = created_at do snapshot da partida (encerramento real)
--   - ts de grupo   = MAX(ts das partidas do grupo) + 2 min (logo após o jogo decisivo)
-- Idempotente: pode ser re-rodado.
CREATE OR REPLACE FUNCTION public.rebuild_leaderboard_timeline(p_pool_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ev RECORD;
BEGIN
  -- Lista estável de eventos (não depende da tabela que será mutada no loop).
  DROP TABLE IF EXISTS _wcp_ev;
  CREATE TEMP TABLE _wcp_ev ON COMMIT DROP AS
  WITH match_ev AS (
    SELECT ls.match_id, MIN(ls.created_at) AS ts
    FROM public.leaderboard_snapshots ls
    WHERE ls.pool_id = p_pool_id AND ls.match_id IS NOT NULL
    GROUP BY ls.match_id
  ),
  group_ev AS (
    SELECT g.id AS group_id,
      (SELECT MAX(me.ts) FROM match_ev me
         JOIN public.matches m ON m.id = me.match_id
        WHERE m.group_id = g.id) + interval '2 minutes' AS ts
    FROM public.groups g
    JOIN public.group_standings gs ON gs.group_id = g.id AND gs.first_id IS NOT NULL
    WHERE EXISTS (
      SELECT 1 FROM public.group_predictions gp
      WHERE gp.group_id = g.id AND gp.pool_id = p_pool_id
    )
  )
  SELECT 'match'::text AS kind, match_id, NULL::uuid AS group_id, ts FROM match_ev
  UNION ALL
  SELECT 'group'::text AS kind, NULL::uuid, group_id, ts FROM group_ev WHERE ts IS NOT NULL;

  -- Processa eventos em ordem cronológica (partida antes de grupo em empate).
  FOR ev IN
    SELECT kind, match_id, group_id, ts FROM _wcp_ev
    ORDER BY ts, CASE WHEN kind = 'match' THEN 0 ELSE 1 END
  LOOP
    -- Remove as linhas anteriores deste evento (idempotência).
    DELETE FROM public.leaderboard_snapshots
    WHERE pool_id = p_pool_id
      AND ( (ev.match_id IS NOT NULL AND match_id = ev.match_id)
         OR (ev.group_id IS NOT NULL AND group_id = ev.group_id) );

    -- Insere o leaderboard cumulativo "até ev.ts".
    INSERT INTO public.leaderboard_snapshots
      (pool_id, match_id, group_id, user_id, rank, total_points, created_at)
    WITH
    m_done AS (
      SELECT match_id FROM _wcp_ev WHERE kind = 'match' AND ts <= ev.ts
    ),
    g_done AS (
      SELECT group_id FROM _wcp_ev WHERE kind = 'group' AND ts <= ev.ts
    ),
    vm AS (
      SELECT pm.user_id
      FROM public.pool_members pm
      WHERE pm.pool_id = p_pool_id
        AND public.is_user_visible_in_ranking(pm.pool_id, pm.user_id)
    ),
    pa AS (
      SELECT pr.user_id,
        COALESCE(SUM(pr.points), 0) AS tp,
        COUNT(*) FILTER (WHERE pr.points = 20) AS c20,
        COUNT(*) FILTER (WHERE pr.points = 15) AS c15,
        COUNT(*) FILTER (WHERE pr.points = 10) AS c10,
        COUNT(*) FILTER (WHERE pr.points = 5)  AS c5
      FROM public.predictions pr
      WHERE pr.pool_id = p_pool_id
        AND pr.points IS NOT NULL
        AND pr.match_id IN (SELECT match_id FROM m_done)
      GROUP BY pr.user_id
    ),
    ba AS (
      SELECT gp.user_id, COALESCE(SUM(gp.points), 0) AS bp
      FROM public.group_predictions gp
      WHERE gp.pool_id = p_pool_id
        AND gp.points IS NOT NULL
        AND gp.group_id IN (SELECT group_id FROM g_done)
      GROUP BY gp.user_id
    ),
    scored AS (
      SELECT vm.user_id,
        COALESCE(pa.tp, 0) + COALESCE(ba.bp, 0) AS total,
        COALESCE(pa.c20, 0) AS c20,
        COALESCE(pa.c15, 0) AS c15,
        COALESCE(pa.c10, 0) AS c10,
        COALESCE(pa.c5, 0)  AS c5
      FROM vm
      LEFT JOIN pa ON pa.user_id = vm.user_id
      LEFT JOIN ba ON ba.user_id = vm.user_id
    ),
    ranked AS (
      SELECT user_id, total,
        RANK() OVER (
          ORDER BY total DESC, c20 DESC, c15 DESC, c10 DESC, c5 DESC
        ) AS rnk
      FROM scored
    )
    SELECT p_pool_id, ev.match_id, ev.group_id, user_id, rnk::integer, total::integer, ev.ts
    FROM ranked;
  END LOOP;

  DROP TABLE IF EXISTS _wcp_ev;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rebuild_leaderboard_timeline(UUID) TO authenticated;

-- ==================== 6. BACKFILL ====================
DO $$
DECLARE
  p RECORD;
BEGIN
  FOR p IN SELECT id FROM public.pools LOOP
    PERFORM public.rebuild_leaderboard_timeline(p.id);
  END LOOP;
END $$;

COMMIT;
