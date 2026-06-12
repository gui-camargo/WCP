-- ============================================================
-- WCP - Visualizar dados de uma partida específica
-- ============================================================
-- Como usar:
-- 1) Edite time_1_sigla e time_2_sigla abaixo.
-- 2) Execute o script.
--
-- Exemplo:
--   time_1_sigla = 'BR'
--   time_2_sigla = 'ZA'
--
-- Siglas disponíveis: BR, AR, DE, FR, ES, IT, NL, BE, PT, etc.
-- ============================================================

WITH params AS (
  SELECT
    'BR'::text AS time_1_sigla,
    'ZA'::text AS time_2_sigla
)
SELECT 
  m.id,
  r.phase,
  r.name as round_name,
  po.name as pool_name,
  t1.name as home_team,
  t1.flag_code as home_sigla,
  t2.name as away_team,
  t2.flag_code as away_sigla,
  m.home_score,
  m.away_score,
  m.kickoff_at,
  m.cutoff_at,
  m.status,
  m.venue,
  (SELECT COUNT(*) FROM public.predictions WHERE match_id = m.id) as total_predictions,
  (SELECT COUNT(*) FROM public.predictions WHERE match_id = m.id AND home_score IS NOT NULL) as confirmed_predictions
FROM public.matches m
JOIN public.rounds r ON r.id = m.round_id
JOIN public.pools po ON po.id = r.pool_id
JOIN public.teams t1 ON t1.id = m.home_team_id
JOIN public.teams t2 ON t2.id = m.away_team_id
CROSS JOIN params p
WHERE (
  (UPPER(COALESCE(t1.flag_code, '')) = UPPER(p.time_1_sigla) AND UPPER(COALESCE(t2.flag_code, '')) = UPPER(p.time_2_sigla))
  OR
  (UPPER(COALESCE(t1.flag_code, '')) = UPPER(p.time_2_sigla) AND UPPER(COALESCE(t2.flag_code, '')) = UPPER(p.time_1_sigla))
)
ORDER BY po.name, r.phase;
