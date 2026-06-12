-- ============================================================
-- WCP - Visualizar palpites de podium (campeão, vice, terceiro)
-- ============================================================
-- Como usar:
-- 1) Opcional: Edite pool_id_filter para filtrar um bolão específico.
-- 2) Opcional: Edite user_id_filter para filtrar um usuário específico.
-- 3) Execute o script.
--
-- Deixe NULL para ver todos os palpites.
-- ============================================================

WITH params AS (
  SELECT
    NULL::uuid AS pool_id_filter,
    NULL::uuid AS user_id_filter
)
SELECT 
  pp.id,
  po.name as pool_name,
  p.name as usuario,
  p.email,
  tc.name as campeao,
  tc.flag_code as campeao_sigla,
  tv.name as vice,
  tv.flag_code as vice_sigla,
  tt.name as terceiro,
  tt.flag_code as terceiro_sigla,
  pp.points,
  pp.created_at,
  CASE 
    WHEN pp.points IS NULL THEN 'Não calculado'
    WHEN pp.points = 0 THEN 'Errado'
    WHEN pp.points = 5 THEN 'Um classificado'
    WHEN pp.points = 10 THEN 'Um na posição certa'
    WHEN pp.points = 15 THEN 'Dois invertidos'
    WHEN pp.points = 20 THEN 'Exato!'
    ELSE 'Desconhecido'
  END as resultado
FROM public.podium_predictions pp
JOIN public.profiles p ON p.id = pp.user_id
JOIN public.pools po ON po.id = pp.pool_id
JOIN public.teams tc ON tc.id = pp.champion_id
JOIN public.teams tv ON tv.id = pp.vice_id
JOIN public.teams tt ON tt.id = pp.third_id
CROSS JOIN params
WHERE (params.pool_id_filter IS NULL OR pp.pool_id = params.pool_id_filter)
  AND (params.user_id_filter IS NULL OR pp.user_id = params.user_id_filter)
ORDER BY po.name, p.name, pp.created_at;
