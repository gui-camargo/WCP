-- ============================================================
-- WCP - Test helper
-- Update cutoff_at to a past date para o jogo entre dois times específicos
-- ============================================================
-- Como usar:
-- 1) Preencha time_1_sigla e time_2_sigla com as siglas desejadas.
-- 2) Opcional: preencha target_pool_id para limitar a um bolao.
-- 3) Execute o script.
--
-- Parametros que voce deve alterar:
-- 'BR'::text AS time_1_sigla
-- 'ZA'::text AS time_2_sigla
-- NULL::uuid AS target_pool_id
-- (now() - interval '3 days')::timestamptz AS new_cutoff_at
--
-- Nota: O script altera o cutoff APENAS do jogo entre time_1 vs time_2 (em qualquer ordem)
--
-- Sigla - Pais:
-- MX - Mexico
-- ZA - Africa do Sul
-- KR - Coreia do Sul
-- CZ - Republica Tcheca
-- CA - Canada
-- BA - Bosnia e Herzegovina
-- QA - Catar
-- CH - Suica
-- BR - Brasil
-- MA - Marrocos
-- HT - Haiti
-- GB - Escocia / Inglaterra
-- US - Estados Unidos
-- PY - Paraguai
-- AU - Australia
-- TR - Turquia
-- DE - Alemanha
-- CW - Curacao
-- CI - Costa do Marfim
-- EC - Equador
-- NL - Holanda
-- JP - Japao
-- SE - Suecia
-- TN - Tunisia
-- BE - Belgica
-- EG - Egito
-- IR - Ira
-- NZ - Nova Zelandia
-- ES - Espanha
-- CV - Cabo Verde
-- SA - Arabia Saudita
-- UY - Uruguai
-- FR - Franca
-- SN - Senegal
-- IQ - Iraque
-- NO - Noruega
-- AR - Argentina
-- DZ - Argelia
-- AT - Austria
-- JO - Jordania
-- CO - Colombia
-- UZ - Uzbequistao
-- PT - Portugal
-- CD - RD Congo
-- HR - Croacia
-- GH - Gana
-- PA - Panama

WITH params AS (
  SELECT
    NULL::uuid AS target_pool_id,
    'BR'::text AS time_1_sigla,
    'ZA'::text AS time_2_sigla,
    '2026-06-11 18:00:00'::timestamptz AS new_cutoff_at
),
target_matches AS (
  SELECT DISTINCT m.id
  FROM public.matches m
  JOIN public.rounds r ON r.id = m.round_id
  JOIN public.teams th ON th.id = m.home_team_id
  JOIN public.teams ta ON ta.id = m.away_team_id
  CROSS JOIN params p
  WHERE (p.target_pool_id IS NULL OR r.pool_id = p.target_pool_id)
    AND p.time_1_sigla IS NOT NULL AND p.time_1_sigla <> ''
    AND p.time_2_sigla IS NOT NULL AND p.time_2_sigla <> ''
    AND (
      (COALESCE(th.flag_code, '') = upper(p.time_1_sigla) AND COALESCE(ta.flag_code, '') = upper(p.time_2_sigla))
      OR
      (COALESCE(th.flag_code, '') = upper(p.time_2_sigla) AND COALESCE(ta.flag_code, '') = upper(p.time_1_sigla))
    )
),
updated AS (
  UPDATE public.matches m
  SET cutoff_at = p.new_cutoff_at
  FROM params p
  WHERE m.id IN (SELECT id FROM target_matches)
  RETURNING m.id, m.cutoff_at
)
SELECT COUNT(*) AS updated_matches,
       MIN(cutoff_at) AS cutoff_min,
       MAX(cutoff_at) AS cutoff_max
FROM updated;
