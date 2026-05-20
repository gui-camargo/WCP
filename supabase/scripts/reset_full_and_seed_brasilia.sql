-- ============================================================
-- WCP – Reset completo + seed oficial (fase de grupos)
-- Fonte: src/assets/seeds.txt (horarios de Brasilia)
--
-- O que este script faz:
-- 1) Remove todos os boloes existentes (cascade em rounds/matches/palpites).
-- 2) Cria 1 bolao novo.
-- 3) Adiciona todos os perfis como membros desse bolao.
-- 4) Cria as rodadas 1, 2 e 3.
-- 5) Insere os 72 jogos da fase de grupos com local e kickoff em BRT.
--
-- Antes de executar:
-- - Ajuste cfg.owner_email para um usuario existente em public.profiles.
-- ============================================================

WITH cfg AS (
  SELECT
    'galetao@gmail.com'::text AS owner_email,
    'Bolão ''Bruno Ba-BET'' Copa 2026'::text AS pool_name
),
seed_groups AS (
  INSERT INTO public.groups (code)
  VALUES
    ('A'),('B'),('C'),('D'),('E'),('F'),
    ('G'),('H'),('I'),('J'),('K'),('L')
  ON CONFLICT (code) DO NOTHING
  RETURNING id, code
),
seed_teams AS (
  INSERT INTO public.teams (name, flag_code) VALUES
    ('México', 'MX'),('África do Sul', 'ZA'),('Coreia do Sul', 'KR'),('República Tcheca', 'CZ'),
    ('Canadá', 'CA'),('Bósnia e Herzegovina', 'BA'),('Catar', 'QA'),('Suíça', 'CH'),
    ('Brasil', 'BR'),('Marrocos', 'MA'),('Haiti', 'HT'),('Escócia', 'GB'),
    ('Estados Unidos', 'US'),('Paraguai', 'PY'),('Austrália', 'AU'),('Turquia', 'TR'),
    ('Alemanha', 'DE'),('Curaçao', 'CW'),('Costa do Marfim', 'CI'),('Equador', 'EC'),
    ('Holanda', 'NL'),('Japão', 'JP'),('Suécia', 'SE'),('Tunísia', 'TN'),
    ('Bélgica', 'BE'),('Egito', 'EG'),('Irã', 'IR'),('Nova Zelândia', 'NZ'),
    ('Espanha', 'ES'),('Cabo Verde', 'CV'),('Arábia Saudita', 'SA'),('Uruguai', 'UY'),
    ('França', 'FR'),('Senegal', 'SN'),('Iraque', 'IQ'),('Noruega', 'NO'),
    ('Argentina', 'AR'),('Argélia', 'DZ'),('Áustria', 'AT'),('Jordânia', 'JO'),
    ('Colômbia', 'CO'),('Uzbequistão', 'UZ'),('Portugal', 'PT'),('RD Congo', 'CD'),
    ('Inglaterra', 'GB'),('Croácia', 'HR'),('Gana', 'GH'),('Panamá', 'PA')
  ON CONFLICT (name) DO UPDATE SET flag_code = EXCLUDED.flag_code
  RETURNING id, name
),
owner_row AS (
  SELECT p.id
  FROM public.profiles p
  JOIN cfg c ON c.owner_email = p.email
  LIMIT 1
),
wipe AS (
  DELETE FROM public.pools
  RETURNING id
),
new_pool AS (
  INSERT INTO public.pools (name, owner_id)
  SELECT c.pool_name, o.id
  FROM cfg c
  JOIN owner_row o ON true
  RETURNING id, owner_id
),
add_members AS (
  INSERT INTO public.pool_members (pool_id, user_id)
  SELECT np.id, p.id
  FROM new_pool np
  CROSS JOIN public.profiles p
  ON CONFLICT (pool_id, user_id) DO NOTHING
  RETURNING pool_id
),
set_active_pool AS (
  UPDATE public.profiles p
  SET active_pool_id = np.id
  FROM new_pool np
  RETURNING p.id
),
round_rows AS (
  SELECT * FROM (VALUES
    (1, 'Rodada 1', 'grupos'),
    (2, 'Rodada 2', 'grupos'),
    (3, 'Rodada 3', 'grupos')
  ) AS t(round_no, round_name, phase)
),
insert_rounds AS (
  INSERT INTO public.rounds (pool_id, name, phase)
  SELECT np.id, rr.round_name, rr.phase
  FROM new_pool np
  JOIN round_rows rr ON true
  RETURNING id, pool_id, name
),
groups_ref AS (
  SELECT sg.id, sg.code
  FROM seed_groups sg
  UNION
  SELECT g.id, g.code
  FROM public.groups g
),
teams_ref AS (
  SELECT st.id, st.name
  FROM seed_teams st
  UNION
  SELECT t.id, t.name
  FROM public.teams t
),
rounds_ref AS (
  SELECT ir.id, ir.pool_id, ir.name
  FROM insert_rounds ir
  UNION
  SELECT r.id, r.pool_id, r.name
  FROM public.rounds r
),
match_rows AS (
  SELECT * FROM (VALUES
    -- Rodada 1
    (1, 'A', 'Mexico', 'Africa do Sul', '2026-06-11 16:00:00-03'::timestamptz, 'Cidade do Mexico, Mexico'),
    (1, 'A', 'Coreia do Sul', 'Republica Tcheca', '2026-06-11 23:00:00-03'::timestamptz, 'Guadalajara, Mexico'),
    (1, 'B', 'Canada', 'Bosnia e Herzegovina', '2026-06-12 16:00:00-03'::timestamptz, 'Toronto, Canada'),
    (1, 'D', 'Estados Unidos', 'Paraguai', '2026-06-12 22:00:00-03'::timestamptz, 'Los Angeles, EUA'),
    (1, 'B', 'Catar', 'Suica', '2026-06-13 16:00:00-03'::timestamptz, 'Santa Clara, EUA'),
    (1, 'C', 'Brasil', 'Marrocos', '2026-06-13 19:00:00-03'::timestamptz, 'Nova York/Nova Jersey, EUA'),
    (1, 'C', 'Haiti', 'Escocia', '2026-06-13 22:00:00-03'::timestamptz, 'Boston, EUA'),
    (1, 'D', 'Australia', 'Turquia', '2026-06-14 01:00:00-03'::timestamptz, 'Vancouver, Canada'),
    (1, 'E', 'Alemanha', 'Curacao', '2026-06-14 14:00:00-03'::timestamptz, 'Houston, EUA'),
    (1, 'E', 'Costa do Marfim', 'Equador', '2026-06-14 20:00:00-03'::timestamptz, 'Filadelfia, EUA'),
    (1, 'F', 'Holanda', 'Japao', '2026-06-14 17:00:00-03'::timestamptz, 'Dallas, EUA'),
    (1, 'F', 'Suecia', 'Tunisia', '2026-06-14 23:00:00-03'::timestamptz, 'Monterrey, Mexico'),
    (1, 'H', 'Espanha', 'Cabo Verde', '2026-06-15 13:00:00-03'::timestamptz, 'Atlanta, EUA'),
    (1, 'H', 'Arabia Saudita', 'Uruguai', '2026-06-15 19:00:00-03'::timestamptz, 'Miami, EUA'),
    (1, 'G', 'Belgica', 'Egito', '2026-06-15 16:00:00-03'::timestamptz, 'Seattle, EUA'),
    (1, 'G', 'Ira', 'Nova Zelandia', '2026-06-15 22:00:00-03'::timestamptz, 'Los Angeles, EUA'),
    (1, 'J', 'Austria', 'Jordania', '2026-06-17 01:00:00-03'::timestamptz, 'Santa Clara, EUA'),
    (1, 'I', 'Franca', 'Senegal', '2026-06-16 16:00:00-03'::timestamptz, 'Nova York/Nova Jersey, EUA'),
    (1, 'I', 'Iraque', 'Noruega', '2026-06-16 19:00:00-03'::timestamptz, 'Boston, EUA'),
    (1, 'J', 'Argentina', 'Argelia', '2026-06-16 22:00:00-03'::timestamptz, 'Kansas City, EUA'),
    (1, 'K', 'Portugal', 'RD Congo', '2026-06-17 14:00:00-03'::timestamptz, 'Houston, EUA'),
    (1, 'L', 'Inglaterra', 'Croacia', '2026-06-17 17:00:00-03'::timestamptz, 'Dallas, EUA'),
    (1, 'L', 'Gana', 'Panama', '2026-06-17 20:00:00-03'::timestamptz, 'Toronto, Canada'),
    (1, 'K', 'Uzbequistao', 'Colombia', '2026-06-17 21:00:00-03'::timestamptz, 'Cidade do Mexico, Mexico'),

    -- Rodada 2
    (2, 'A', 'Republica Tcheca', 'Africa do Sul', '2026-06-18 13:00:00-03'::timestamptz, 'Atlanta, EUA'),
    (2, 'B', 'Suica', 'Bosnia e Herzegovina', '2026-06-18 16:00:00-03'::timestamptz, 'Los Angeles, EUA'),
    (2, 'B', 'Canada', 'Catar', '2026-06-18 19:00:00-03'::timestamptz, 'Vancouver, Canada'),
    (2, 'A', 'Mexico', 'Coreia do Sul', '2026-06-18 22:00:00-03'::timestamptz, 'Guadalajara, Mexico'),
    (2, 'D', 'Turquia', 'Paraguai', '2026-06-19 00:00:00-03'::timestamptz, 'Santa Clara, EUA'),
    (2, 'D', 'Estados Unidos', 'Australia', '2026-06-19 16:00:00-03'::timestamptz, 'Seattle, EUA'),
    (2, 'C', 'Escocia', 'Marrocos', '2026-06-19 19:00:00-03'::timestamptz, 'Boston, EUA'),
    (2, 'C', 'Brasil', 'Haiti', '2026-06-19 21:30:00-03'::timestamptz, 'Filadelfia, EUA'),
    (2, 'F', 'Tunisia', 'Japao', '2026-06-20 23:00:00-03'::timestamptz, 'Monterrey, Mexico'),
    (2, 'F', 'Holanda', 'Suecia', '2026-06-20 14:00:00-03'::timestamptz, 'Houston, EUA'),
    (2, 'E', 'Alemanha', 'Costa do Marfim', '2026-06-20 17:00:00-03'::timestamptz, 'Toronto, Canada'),
    (2, 'E', 'Equador', 'Curacao', '2026-06-20 21:00:00-03'::timestamptz, 'Kansas City, EUA'),
    (2, 'H', 'Espanha', 'Arabia Saudita', '2026-06-21 13:00:00-03'::timestamptz, 'Atlanta, EUA'),
    (2, 'G', 'Belgica', 'Ira', '2026-06-21 16:00:00-03'::timestamptz, 'Los Angeles, EUA'),
    (2, 'H', 'Uruguai', 'Cabo Verde', '2026-06-21 19:00:00-03'::timestamptz, 'Miami, EUA'),
    (2, 'G', 'Nova Zelandia', 'Egito', '2026-06-21 22:00:00-03'::timestamptz, 'Vancouver, Canada'),
    (2, 'J', 'Argentina', 'Austria', '2026-06-22 14:00:00-03'::timestamptz, 'Dallas, EUA'),
    (2, 'I', 'Franca', 'Iraque', '2026-06-22 18:00:00-03'::timestamptz, 'Filadelfia, EUA'),
    (2, 'I', 'Noruega', 'Senegal', '2026-06-22 21:00:00-03'::timestamptz, 'Nova York/Nova Jersey, EUA'),
    (2, 'J', 'Jordania', 'Argelia', '2026-06-23 00:00:00-03'::timestamptz, 'Santa Clara, EUA'),
    (2, 'K', 'Portugal', 'Uzbequistao', '2026-06-23 14:00:00-03'::timestamptz, 'Houston, EUA'),
    (2, 'L', 'Inglaterra', 'Gana', '2026-06-23 17:00:00-03'::timestamptz, 'Boston, EUA'),
    (2, 'L', 'Panama', 'Croacia', '2026-06-23 20:00:00-03'::timestamptz, 'Toronto, Canada'),
    (2, 'K', 'Colombia', 'RD Congo', '2026-06-23 23:00:00-03'::timestamptz, 'Guadalajara, Mexico'),

    -- Rodada 3
    (3, 'B', 'Suica', 'Canada', '2026-06-24 16:00:00-03'::timestamptz, 'Vancouver, Canada'),
    (3, 'B', 'Bosnia e Herzegovina', 'Catar', '2026-06-24 16:00:00-03'::timestamptz, 'Seattle, EUA'),
    (3, 'C', 'Escocia', 'Brasil', '2026-06-24 19:00:00-03'::timestamptz, 'Miami, EUA'),
    (3, 'C', 'Marrocos', 'Haiti', '2026-06-24 19:00:00-03'::timestamptz, 'Atlanta, EUA'),
    (3, 'A', 'Republica Tcheca', 'Mexico', '2026-06-24 22:00:00-03'::timestamptz, 'Cidade do Mexico, Mexico'),
    (3, 'A', 'Africa do Sul', 'Coreia do Sul', '2026-06-24 22:00:00-03'::timestamptz, 'Monterrey, Mexico'),
    (3, 'E', 'Equador', 'Alemanha', '2026-06-25 17:00:00-03'::timestamptz, 'Nova York/Nova Jersey, EUA'),
    (3, 'E', 'Curacao', 'Costa do Marfim', '2026-06-25 17:00:00-03'::timestamptz, 'Filadelfia, EUA'),
    (3, 'F', 'Japao', 'Suecia', '2026-06-25 20:00:00-03'::timestamptz, 'Dallas, EUA'),
    (3, 'F', 'Tunisia', 'Holanda', '2026-06-25 20:00:00-03'::timestamptz, 'Kansas City, EUA'),
    (3, 'D', 'Turquia', 'Estados Unidos', '2026-06-25 23:00:00-03'::timestamptz, 'Los Angeles, EUA'),
    (3, 'D', 'Paraguai', 'Australia', '2026-06-25 23:00:00-03'::timestamptz, 'Santa Clara, EUA'),
    (3, 'I', 'Noruega', 'Franca', '2026-06-26 16:00:00-03'::timestamptz, 'Boston, EUA'),
    (3, 'I', 'Senegal', 'Iraque', '2026-06-26 16:00:00-03'::timestamptz, 'Toronto, Canada'),
    (3, 'H', 'Cabo Verde', 'Arabia Saudita', '2026-06-26 21:00:00-03'::timestamptz, 'Houston, EUA'),
    (3, 'H', 'Uruguai', 'Espanha', '2026-06-26 21:00:00-03'::timestamptz, 'Guadalajara, Mexico'),
    (3, 'G', 'Egito', 'Ira', '2026-06-27 00:00:00-03'::timestamptz, 'Seattle, EUA'),
    (3, 'G', 'Nova Zelandia', 'Belgica', '2026-06-27 00:00:00-03'::timestamptz, 'Vancouver, Canada'),
    (3, 'L', 'Panama', 'Inglaterra', '2026-06-27 18:00:00-03'::timestamptz, 'Nova York/Nova Jersey, EUA'),
    (3, 'L', 'Croacia', 'Gana', '2026-06-27 18:00:00-03'::timestamptz, 'Filadelfia, EUA'),
    (3, 'K', 'Colombia', 'Portugal', '2026-06-27 20:30:00-03'::timestamptz, 'Miami, EUA'),
    (3, 'K', 'RD Congo', 'Uzbequistao', '2026-06-27 20:30:00-03'::timestamptz, 'Atlanta, EUA'),
    (3, 'J', 'Argelia', 'Austria', '2026-06-27 23:00:00-03'::timestamptz, 'Kansas City, EUA'),
    (3, 'J', 'Jordania', 'Argentina', '2026-06-27 23:00:00-03'::timestamptz, 'Dallas, EUA')
  ) AS t(round_no, group_code, home_team_raw, away_team_raw, kickoff_brt, venue)
),
normalized_rows AS (
  SELECT
    mr.round_no,
    mr.group_code,
    CASE mr.home_team_raw
      WHEN 'Mexico' THEN 'México'
      WHEN 'Republica da Coreia' THEN 'Coreia do Sul'
      WHEN 'Africa do Sul' THEN 'África do Sul'
      WHEN 'Republica Tcheca' THEN 'República Tcheca'
      WHEN 'Canada' THEN 'Canadá'
      WHEN 'Bosnia e Herzegovina' THEN 'Bósnia e Herzegovina'
      WHEN 'Suica' THEN 'Suíça'
      WHEN 'Escocia' THEN 'Escócia'
      WHEN 'Australia' THEN 'Austrália'
      WHEN 'Curacao' THEN 'Curaçao'
      WHEN 'Japao' THEN 'Japão'
      WHEN 'Suecia' THEN 'Suécia'
      WHEN 'Tunisia' THEN 'Tunísia'
      WHEN 'Espanha' THEN 'Espanha'
      WHEN 'Arabia Saudita' THEN 'Arábia Saudita'
      WHEN 'Belgica' THEN 'Bélgica'
      WHEN 'Ira' THEN 'Irã'
      WHEN 'Nova Zelandia' THEN 'Nova Zelândia'
      WHEN 'Austria' THEN 'Áustria'
      WHEN 'Jordania' THEN 'Jordânia'
      WHEN 'Franca' THEN 'França'
      WHEN 'Argelia' THEN 'Argélia'
      WHEN 'Colombia' THEN 'Colômbia'
      WHEN 'Uzbequistao' THEN 'Uzbequistão'
      WHEN 'Croacia' THEN 'Croácia'
      WHEN 'Panama' THEN 'Panamá'
      ELSE mr.home_team_raw
    END AS home_team,
    CASE mr.away_team_raw
      WHEN 'Mexico' THEN 'México'
      WHEN 'Republica da Coreia' THEN 'Coreia do Sul'
      WHEN 'Africa do Sul' THEN 'África do Sul'
      WHEN 'Republica Tcheca' THEN 'República Tcheca'
      WHEN 'Canada' THEN 'Canadá'
      WHEN 'Bosnia e Herzegovina' THEN 'Bósnia e Herzegovina'
      WHEN 'Suica' THEN 'Suíça'
      WHEN 'Escocia' THEN 'Escócia'
      WHEN 'Australia' THEN 'Austrália'
      WHEN 'Curacao' THEN 'Curaçao'
      WHEN 'Japao' THEN 'Japão'
      WHEN 'Suecia' THEN 'Suécia'
      WHEN 'Tunisia' THEN 'Tunísia'
      WHEN 'Espanha' THEN 'Espanha'
      WHEN 'Arabia Saudita' THEN 'Arábia Saudita'
      WHEN 'Belgica' THEN 'Bélgica'
      WHEN 'Ira' THEN 'Irã'
      WHEN 'Nova Zelandia' THEN 'Nova Zelândia'
      WHEN 'Austria' THEN 'Áustria'
      WHEN 'Jordania' THEN 'Jordânia'
      WHEN 'Franca' THEN 'França'
      WHEN 'Argelia' THEN 'Argélia'
      WHEN 'Colombia' THEN 'Colômbia'
      WHEN 'Uzbequistao' THEN 'Uzbequistão'
      WHEN 'Croacia' THEN 'Croácia'
      WHEN 'Panama' THEN 'Panamá'
      ELSE mr.away_team_raw
    END AS away_team,
    mr.kickoff_brt,
    mr.venue
  FROM match_rows mr
),
resolved AS (
  SELECT
    rr.id AS round_id,
    g.id AS group_id,
    th.id AS home_team_id,
    ta.id AS away_team_id,
    nr.kickoff_brt AS kickoff_at,
    nr.venue
  FROM normalized_rows nr
  JOIN new_pool np ON true
  JOIN rounds_ref rr
    ON rr.pool_id = np.id
   AND rr.name = ('Rodada ' || nr.round_no)
  JOIN groups_ref g
    ON g.code = nr.group_code
  JOIN teams_ref th
    ON th.name = nr.home_team
  JOIN teams_ref ta
    ON ta.name = nr.away_team
),
unresolved AS (
  SELECT
    nr.round_no,
    nr.group_code,
    nr.home_team,
    nr.away_team
  FROM normalized_rows nr
  JOIN new_pool np ON true
  LEFT JOIN rounds_ref rr
    ON rr.pool_id = np.id
   AND rr.name = ('Rodada ' || nr.round_no)
  LEFT JOIN groups_ref g
    ON g.code = nr.group_code
  LEFT JOIN teams_ref th
    ON th.name = nr.home_team
  LEFT JOIN teams_ref ta
    ON ta.name = nr.away_team
  WHERE rr.id IS NULL OR g.id IS NULL OR th.id IS NULL OR ta.id IS NULL
),
insert_matches AS (
  INSERT INTO public.matches (round_id, group_id, home_team_id, away_team_id, kickoff_at, venue)
  SELECT
    rs.round_id,
    rs.group_id,
    rs.home_team_id,
    rs.away_team_id,
    rs.kickoff_at,
    rs.venue
  FROM resolved rs
  RETURNING id
)
SELECT
  (SELECT COUNT(*) FROM owner_row) AS owner_found,
  (SELECT COUNT(*) FROM seed_groups) AS groups_inserted_now,
  (SELECT COUNT(*) FROM seed_teams) AS teams_inserted_now,
  (SELECT COUNT(*) FROM public.groups) AS groups_total,
  (SELECT COUNT(*) FROM public.teams) AS teams_total,
  (SELECT COUNT(*) FROM wipe) AS pools_deleted,
  (SELECT id FROM new_pool LIMIT 1) AS created_pool_id,
  (SELECT COUNT(*) FROM insert_rounds) AS rounds_inserted,
  (SELECT COUNT(*) FROM unresolved) AS unresolved_matches,
  (SELECT COUNT(*) FROM insert_matches) AS matches_inserted;
