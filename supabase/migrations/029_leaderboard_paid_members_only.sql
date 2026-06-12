-- ============================================================
-- 029 - Ranking visivel para todos os membros do bolao,
--       considerando apenas pagantes confirmados (admins inclusos)
-- ============================================================

-- Helper de visibilidade para ranking.
-- Regra:
-- - Admin sempre aparece no ranking.
-- - Nao-admin so aparece se pagamento estiver confirmado no bolao.
CREATE OR REPLACE FUNCTION public.is_user_visible_in_ranking(p_pool_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE((
      SELECT pr.is_admin
      FROM public.profiles pr
      WHERE pr.id = p_user_id
    ), false)
    OR EXISTS (
      SELECT 1
      FROM public.payments pay
      WHERE pay.pool_id = p_pool_id
        AND pay.user_id = p_user_id
        AND pay.status = 'confirmado'
    );
$$;

GRANT EXECUTE ON FUNCTION public.is_user_visible_in_ranking(UUID, UUID) TO authenticated;

-- Recria leaderboard aplicando a regra de visibilidade acima.
CREATE OR REPLACE VIEW public.leaderboard AS
SELECT
  pm.pool_id,
  p.id                                         AS user_id,
  p.name                                       AS user_name,
  COALESCE(SUM(pred.points), 0) +
  COALESCE(SUM(gp.points), 0)                  AS total_points,
  RANK() OVER (
    PARTITION BY pm.pool_id
    ORDER BY COALESCE(SUM(pred.points), 0) + COALESCE(SUM(gp.points), 0) DESC
  )                                            AS rank
FROM public.pool_members pm
JOIN public.profiles p ON p.id = pm.user_id
LEFT JOIN public.predictions pred
  ON pred.user_id = pm.user_id AND pred.pool_id = pm.pool_id
LEFT JOIN public.group_predictions gp
  ON gp.user_id = pm.user_id AND gp.pool_id = pm.pool_id
WHERE public.is_user_visible_in_ranking(pm.pool_id, pm.user_id)
GROUP BY pm.pool_id, p.id, p.name;
