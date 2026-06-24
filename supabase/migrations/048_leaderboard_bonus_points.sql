-- ============================================================
-- 048 - Separa pontos de classificação de grupos como bônus
--
-- O que muda no leaderboard VIEW:
--   - group_predictions deixa de contribuir para c20/c15/c10/c5/c0
--   - Nova coluna bonus_points = soma de pontos de group_predictions
--   - total_points continua incluindo o bônus
--   - Regra de desempate usa c20/c15/c10/c5 apenas de partidas
-- ============================================================

DROP VIEW IF EXISTS public.leaderboard;

CREATE VIEW public.leaderboard AS
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
    COALESCE(SUM(gp.points), 0) AS bonus_points
  FROM public.group_predictions gp
  WHERE gp.points IS NOT NULL
  GROUP BY gp.pool_id, gp.user_id
),
scored AS (
  SELECT
    vm.pool_id,
    vm.user_id,
    vm.user_name,
    COALESCE(pa.total_points, 0) + COALESCE(gpa.bonus_points, 0) AS total_points,
    COALESCE(gpa.bonus_points, 0) AS bonus_points,
    COALESCE(pa.c20, 0) AS c20,
    COALESCE(pa.c15, 0) AS c15,
    COALESCE(pa.c10, 0) AS c10,
    COALESCE(pa.c5, 0) AS c5,
    COALESCE(pa.c0, 0) AS c0
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
  s.bonus_points,
  s.c20,
  s.c15,
  s.c10,
  s.c5,
  s.c0
FROM scored s;

GRANT SELECT ON TABLE public.leaderboard TO authenticated;
