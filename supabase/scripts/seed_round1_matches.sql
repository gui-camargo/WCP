-- ============================================================
-- DEPRECADO
--
-- Este script antigo de Rodada 1 foi substituido por:
--   supabase/scripts/reset_full_and_seed_brasilia.sql
--
-- O novo script usa a agenda oficial em horario de Brasilia
-- e inclui local (venue) dos jogos.
-- ============================================================

SELECT
  'DEPRECADO: use supabase/scripts/reset_full_and_seed_brasilia.sql' AS aviso;

-- Conteudo legado mantido abaixo apenas para historico.

WITH params AS (
  SELECT
    'd72802ea-b530-4471-ba03-d56cb716d79c'::uuid AS pool_id,
    'Rodada 1'::text AS round_name
),
match_rows AS (
  SELECT * FROM (VALUES
    -- Grupo A
    ('A', 'México', 'África do Sul', '2026-06-11 12:00:00+00'::timestamptz),
    ('A', 'Coreia do Sul', 'República Tcheca', '2026-06-11 15:00:00+00'::timestamptz),

    -- Grupo B
    ('B', 'Canadá', 'Bósnia e Herzegovina', '2026-06-11 18:00:00+00'::timestamptz),
    ('B', 'Catar', 'Suíça', '2026-06-11 21:00:00+00'::timestamptz),

    -- Grupo C
    ('C', 'Brasil', 'Marrocos', '2026-06-10 12:00:00+00'::timestamptz),
    ('C', 'Haiti', 'Escócia', '2026-06-10 15:00:00+00'::timestamptz),

    -- Grupo D
    ('D', 'Estados Unidos', 'Paraguai', '2026-06-11 12:00:00+00'::timestamptz),
    ('D', 'Austrália', 'Turquia', '2026-06-11 15:00:00+00'::timestamptz),

    -- Grupo E
    ('E', 'Alemanha', 'Curaçao', '2026-06-10 18:00:00+00'::timestamptz),
    ('E', 'Costa do Marfim', 'Equador', '2026-06-10 21:00:00+00'::timestamptz),

    -- Grupo F
    ('F', 'Holanda', 'Japão', '2026-06-11 18:00:00+00'::timestamptz),
    ('F', 'Suécia', 'Tunísia', '2026-06-11 21:00:00+00'::timestamptz),

    -- Grupo G
    ('G', 'Bélgica', 'Egito', '2026-06-12 15:00:00+00'::timestamptz),
    ('G', 'Irã', 'Nova Zelândia', '2026-06-12 18:00:00+00'::timestamptz),

    -- Grupo H
    ('H', 'Espanha', 'Cabo Verde', '2026-06-12 12:00:00+00'::timestamptz),
    ('H', 'Arábia Saudita', 'Uruguai', '2026-06-12 15:00:00+00'::timestamptz),

    -- Grupo I
    ('I', 'França', 'Senegal', '2026-06-12 18:00:00+00'::timestamptz),
    ('I', 'Iraque', 'Noruega', '2026-06-12 21:00:00+00'::timestamptz),

    -- Grupo J
    ('J', 'Argentina', 'Argélia', '2026-06-13 15:00:00+00'::timestamptz),
    ('J', 'Áustria', 'Jordânia', '2026-06-13 18:00:00+00'::timestamptz),

    -- Grupo K
    ('K', 'Colômbia', 'Uzbequistão', '2026-06-13 12:00:00+00'::timestamptz),
    ('K', 'Portugal', 'RD Congo', '2026-06-13 15:00:00+00'::timestamptz),

    -- Grupo L
    ('L', 'Inglaterra', 'Croácia', '2026-06-13 18:00:00+00'::timestamptz),
    ('L', 'Gana', 'Panamá', '2026-06-13 21:00:00+00'::timestamptz)
  ) AS t(group_code, home_team, away_team, kickoff_at)
),
resolved AS (
  SELECT
    r.id AS round_id,
    g.id AS group_id,
    th.id AS home_team_id,
    ta.id AS away_team_id,
    mr.kickoff_at
  FROM match_rows mr
  JOIN params p ON true
  JOIN public.rounds r
    ON r.pool_id = p.pool_id
   AND r.name = p.round_name
  JOIN public.groups g
    ON g.code = mr.group_code
  JOIN public.teams th
    ON th.name = mr.home_team
  JOIN public.teams ta
    ON ta.name = mr.away_team
)
INSERT INTO public.matches (round_id, group_id, home_team_id, away_team_id, kickoff_at)
SELECT
  rs.round_id,
  rs.group_id,
  rs.home_team_id,
  rs.away_team_id,
  rs.kickoff_at
FROM resolved rs
LEFT JOIN public.matches m
  ON m.round_id = rs.round_id
 AND m.home_team_id = rs.home_team_id
 AND m.away_team_id = rs.away_team_id
WHERE m.id IS NULL;

-- Verificacao opcional:
-- SELECT g.code AS grupo, COUNT(m.id) AS jogos
-- FROM public.rounds r
-- LEFT JOIN public.matches m ON m.round_id = r.id
-- LEFT JOIN public.groups g ON g.id = m.group_id
-- WHERE r.pool_id = 'd72802ea-b530-4471-ba03-d56cb716d79c'
--   AND r.name = 'Rodada 1'
-- GROUP BY g.code
-- ORDER BY g.code;
