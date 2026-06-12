-- ============================================================
-- 030 - Unifica criterio de desempate do ranking
--
-- Ordem de classificacao:
-- 1) total_points (desc)
-- 2) quantidade de 20 pontos (desc)
-- 3) quantidade de 15 pontos (desc)
-- 4) quantidade de 10 pontos (desc)
-- 5) quantidade de 5 pontos (desc)
-- Se todos os criterios acima forem iguais, membros empatam na mesma posicao.
-- ============================================================

CREATE OR REPLACE VIEW public.leaderboard AS
WITH visible_members AS (
  SELECT
    pm.pool_id,
    p.id AS user_id,
    p.name AS user_name
  FROM public.pool_members pm
  JOIN public.profiles p ON p.id = pm.user_id
  WHERE public.is_user_visible_in_ranking(pm.pool_id, pm.user_id)
),
pred_agg AS (
  SELECT
    pr.pool_id,
    pr.user_id,
    COALESCE(SUM(pr.points), 0) AS total_points,
    COUNT(*) FILTER (WHERE pr.points = 20) AS c20,
    COUNT(*) FILTER (WHERE pr.points = 15) AS c15,
    COUNT(*) FILTER (WHERE pr.points = 10) AS c10,
    COUNT(*) FILTER (WHERE pr.points = 5) AS c5,
    COUNT(*) FILTER (WHERE pr.points = 0) AS c0
  FROM public.predictions pr
  WHERE pr.points IS NOT NULL
  GROUP BY pr.pool_id, pr.user_id
),
group_pred_agg AS (
  SELECT
    gp.pool_id,
    gp.user_id,
    COALESCE(SUM(gp.points), 0) AS total_points,
    COUNT(*) FILTER (WHERE gp.points = 20) AS c20,
    COUNT(*) FILTER (WHERE gp.points = 15) AS c15,
    COUNT(*) FILTER (WHERE gp.points = 10) AS c10,
    COUNT(*) FILTER (WHERE gp.points = 5) AS c5,
    COUNT(*) FILTER (WHERE gp.points = 0) AS c0
  FROM public.group_predictions gp
  WHERE gp.points IS NOT NULL
  GROUP BY gp.pool_id, gp.user_id
),
scored AS (
  SELECT
    vm.pool_id,
    vm.user_id,
    vm.user_name,
    COALESCE(pa.total_points, 0) + COALESCE(gpa.total_points, 0) AS total_points,
    COALESCE(pa.c20, 0) + COALESCE(gpa.c20, 0) AS c20,
    COALESCE(pa.c15, 0) + COALESCE(gpa.c15, 0) AS c15,
    COALESCE(pa.c10, 0) + COALESCE(gpa.c10, 0) AS c10,
    COALESCE(pa.c5, 0) + COALESCE(gpa.c5, 0) AS c5,
    COALESCE(pa.c0, 0) + COALESCE(gpa.c0, 0) AS c0
  FROM visible_members vm
  LEFT JOIN pred_agg pa
    ON pa.pool_id = vm.pool_id AND pa.user_id = vm.user_id
  LEFT JOIN group_pred_agg gpa
    ON gpa.pool_id = vm.pool_id AND gpa.user_id = vm.user_id
)
SELECT
  s.pool_id,
  s.user_id,
  s.user_name,
  s.total_points,
  RANK() OVER (
    PARTITION BY s.pool_id
    ORDER BY
      s.total_points DESC,
      s.c20 DESC,
      s.c15 DESC,
      s.c10 DESC,
      s.c5 DESC
  ) AS rank,
  s.c20,
  s.c15,
  s.c10,
  s.c5,
  s.c0
FROM scored s;

GRANT SELECT ON TABLE public.leaderboard TO authenticated;
