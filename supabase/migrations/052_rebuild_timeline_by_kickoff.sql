-- ============================================================
-- WCP – Migration 052
-- Corrige rebuild_leaderboard_timeline para ordenar a timeline pelo
-- kickoff_at do jogo (cronologia confiável), em vez do created_at do
-- snapshot — que estava "amontoado" e fazia o ranking histórico sair
-- plano (todos os eventos somavam o total final).
--
-- Mudanças vs 051:
--   - match_ev.ts = matches.kickoff_at (lê direto de matches; inclui
--     TODOS os jogos encerrados do pool, mesmo os que não tinham snapshot)
--   - group_ev.ts = MAX(kickoff_at das partidas do grupo) + 2 min
--   - created_at do snapshot passa a ser esse ts (cronológico, espaçado)
-- Re-roda o backfill ao final.
-- ============================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.rebuild_leaderboard_timeline(p_pool_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ev RECORD;
BEGIN
  -- Lista estável de eventos, em ordem cronológica por kickoff_at.
  DROP TABLE IF EXISTS _wcp_ev;
  CREATE TEMP TABLE _wcp_ev ON COMMIT DROP AS
  WITH match_ev AS (
    SELECT m.id AS match_id, m.kickoff_at AS ts
    FROM public.matches m
    JOIN public.rounds r ON r.id = m.round_id
    WHERE r.pool_id = p_pool_id AND m.status = 'encerrado'
  ),
  group_ev AS (
    SELECT g.id AS group_id,
      (SELECT MAX(m.kickoff_at) FROM public.matches m
        WHERE m.group_id = g.id AND m.status = 'encerrado') + interval '2 minutes' AS ts
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

  -- Remove snapshots antigos do pool e reconstrói tudo do zero (idempotente).
  DELETE FROM public.leaderboard_snapshots WHERE pool_id = p_pool_id;

  -- Processa eventos em ordem cronológica (partida antes de grupo em empate).
  FOR ev IN
    SELECT kind, match_id, group_id, ts FROM _wcp_ev
    ORDER BY ts, CASE WHEN kind = 'match' THEN 0 ELSE 1 END
  LOOP
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

-- ==================== RE-BACKFILL ====================
DO $$
DECLARE
  p RECORD;
BEGIN
  FOR p IN SELECT id FROM public.pools LOOP
    PERFORM public.rebuild_leaderboard_timeline(p.id);
  END LOOP;
END $$;

COMMIT;
