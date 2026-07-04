-- ============================================================
-- WCP – Migration 053
-- (1) Coluna matches.ended_at + trigger que a preenche no encerramento.
-- (2) Reconstrução com ordem cronológica ESTRITA:
--       ts do jogo  = COALESCE(ended_at, kickoff_at)
--       ts do grupo = MAX(ts dos jogos do grupo) + 2 min
--     ordenado por (ts, partida-antes-de-grupo, id) → id só como ÚLTIMO desempate.
--
-- Por quê: jogos simultâneos (ex.: os 2 jogos finais de um grupo têm o mesmo
-- kickoff_at) caíam no mesmo instante e o snapshot somava os dois → quem fez 0
-- num e pontuou no simultâneo aparecia "subindo". A ordem estrita (seq único)
-- separa cada jogo, que passa a refletir só o seu efeito. O ended_at dá, daqui
-- pra frente, a ordem real de encerramento (sem depender do id).
--
-- Histórico já encerrado fica com ended_at NULL (a hora real foi perdida nos
-- backfills anteriores) → cai em kickoff_at, como antes.
--
-- created_at do snapshot = ts + (seq ms): único e monotônico, para o
-- get_match_ranking_delta achar o "evento imediatamente anterior".
-- Re-roda o backfill ao final.
-- ============================================================

BEGIN;

-- ==================== 1. matches.ended_at ====================
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS ended_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION public.set_match_ended_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Marca o horário real do encerramento na transição para 'encerrado'.
  IF NEW.status = 'encerrado' AND OLD.status IS DISTINCT FROM 'encerrado' THEN
    NEW.ended_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_match_ended_at ON public.matches;
CREATE TRIGGER trg_set_match_ended_at
  BEFORE UPDATE ON public.matches
  FOR EACH ROW EXECUTE FUNCTION public.set_match_ended_at();

-- ==================== 2. rebuild_leaderboard_timeline ====================
CREATE OR REPLACE FUNCTION public.rebuild_leaderboard_timeline(p_pool_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ev RECORD;
BEGIN
  -- Lista estável de eventos com ordem estrita (seq) e created_at único.
  DROP TABLE IF EXISTS _wcp_ev;
  CREATE TEMP TABLE _wcp_ev ON COMMIT DROP AS
  WITH match_ev AS (
    SELECT 'match'::text AS kind, m.id AS match_id, NULL::uuid AS group_id,
           COALESCE(m.ended_at, m.kickoff_at) AS ts
    FROM public.matches m
    JOIN public.rounds r ON r.id = m.round_id
    WHERE r.pool_id = p_pool_id AND m.status = 'encerrado'
  ),
  group_ev AS (
    SELECT 'group'::text AS kind, NULL::uuid AS match_id, g.id AS group_id,
      (SELECT MAX(COALESCE(m.ended_at, m.kickoff_at)) FROM public.matches m
        WHERE m.group_id = g.id AND m.status = 'encerrado') + interval '2 minutes' AS ts
    FROM public.groups g
    JOIN public.group_standings gs ON gs.group_id = g.id AND gs.first_id IS NOT NULL
    WHERE EXISTS (
      SELECT 1 FROM public.group_predictions gp
      WHERE gp.group_id = g.id AND gp.pool_id = p_pool_id
    )
  ),
  all_ev AS (
    SELECT kind, match_id, group_id, ts FROM match_ev
    UNION ALL
    SELECT kind, match_id, group_id, ts FROM group_ev WHERE ts IS NOT NULL
  )
  SELECT kind, match_id, group_id, ts,
    ROW_NUMBER() OVER (
      ORDER BY ts,
        CASE WHEN kind = 'match' THEN 0 ELSE 1 END,
        COALESCE(match_id, group_id)
    ) AS seq
  FROM all_ev;

  -- Reconstrói tudo do zero (idempotente).
  DELETE FROM public.leaderboard_snapshots WHERE pool_id = p_pool_id;

  FOR ev IN SELECT kind, match_id, group_id, ts, seq FROM _wcp_ev ORDER BY seq LOOP
    -- Insere o leaderboard cumulativo "até ev.seq" (ordem estrita).
    INSERT INTO public.leaderboard_snapshots
      (pool_id, match_id, group_id, user_id, rank, total_points, created_at)
    WITH
    m_done AS (
      SELECT match_id FROM _wcp_ev WHERE kind = 'match' AND seq <= ev.seq
    ),
    g_done AS (
      SELECT group_id FROM _wcp_ev WHERE kind = 'group' AND seq <= ev.seq
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
    SELECT p_pool_id, ev.match_id, ev.group_id, user_id, rnk::integer, total::integer,
           ev.ts + (ev.seq * interval '1 millisecond')
    FROM ranked;
  END LOOP;

  DROP TABLE IF EXISTS _wcp_ev;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rebuild_leaderboard_timeline(UUID) TO authenticated;

-- ==================== 3. RE-BACKFILL ====================
DO $$
DECLARE
  p RECORD;
BEGIN
  FOR p IN SELECT id FROM public.pools LOOP
    PERFORM public.rebuild_leaderboard_timeline(p.id);
  END LOOP;
END $$;

COMMIT;
