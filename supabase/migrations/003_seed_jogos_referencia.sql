-- ============================================================
-- WCP – Seed helper: Inserir jogos de um bolão específico
-- Substitua :pool_id pelo UUID do seu bolão no Supabase
-- Crie primeiro as rodadas via Admin UI ou SQL, depois rode
-- este script substituindo os round_ids reais.
--
-- Exemplo de criação de rodadas:
-- INSERT INTO rounds (pool_id, name, phase) VALUES
--   ('<POOL_ID>', 'Grupo A – Rodada 1', 'grupos'),
--   ('<POOL_ID>', 'Grupo A – Rodada 2', 'grupos'),
--   ...
-- ============================================================

-- ==================== JOGOS POR GRUPO ====================
-- Para cada rodada, substitua <round_id_AX> pelo id real.

-- ---- GRUPO A ----
-- Rodada 1
-- INSERT INTO matches (round_id, group_id, home_team_id, away_team_id, kickoff_at) VALUES
--   ((SELECT id FROM rounds WHERE name='Grupo A – Rodada 1' AND pool_id='<POOL_ID>'),
--    (SELECT id FROM groups WHERE code='A'),
--    (SELECT id FROM teams WHERE name='México'),
--    (SELECT id FROM teams WHERE name='África do Sul'), '2026-06-11 12:00:00+00'),
--   ((SELECT id FROM rounds WHERE name='Grupo A – Rodada 1' AND pool_id='<POOL_ID>'),
--    (SELECT id FROM groups WHERE code='A'),
--    (SELECT id FROM teams WHERE name='Coreia do Sul'),
--    (SELECT id FROM teams WHERE name='República Tcheca'), '2026-06-11 15:00:00+00');

-- Rodada 2
-- INSERT INTO matches (...) VALUES
--   (... 'República Tcheca' vs 'África do Sul' ...),
--   (... 'México' vs 'Coreia do Sul' ...);

-- Rodada 3
-- INSERT INTO matches (...) VALUES
--   (... 'República Tcheca' vs 'México' ...),
--   (... 'África do Sul' vs 'Coreia do Sul' ...);

-- ---- GRUPO B ----
-- Rodada 1: Canadá vs Bósnia e Herzegovina | Catar vs Suíça
-- Rodada 2: Suíça vs Bósnia e Herzegovina | Canadá vs Catar
-- Rodada 3: Suíça vs Canadá | Bósnia e Herzegovina vs Catar

-- ---- GRUPO C ----
-- Rodada 1: Brasil vs Marrocos | Haiti vs Escócia
-- Rodada 2: Escócia vs Marrocos | Brasil vs Haiti
-- Rodada 3: Escócia vs Brasil | Marrocos vs Haiti

-- ---- GRUPO D ----
-- Rodada 1: Estados Unidos vs Paraguai | Austrália vs Turquia
-- Rodada 2: Austrália vs Paraguai | Estados Unidos vs Turquia
-- Rodada 3: Estados Unidos vs Austrália | Paraguai vs Turquia

-- ---- GRUPO E ----
-- Rodada 1: Alemanha vs Curaçao | Costa do Marfim vs Equador
-- Rodada 2: Alemanha vs Equador | Costa do Marfim vs Curaçao
-- Rodada 3: Alemanha vs Costa do Marfim | Equador vs Curaçao

-- ---- GRUPO F ----
-- Rodada 1: Holanda vs Japão | Suécia vs Tunísia
-- Rodada 2: Japão vs Tunísia | Holanda vs Suécia
-- Rodada 3: Holanda vs Tunísia | Japão vs Suécia

-- ---- GRUPO G ----
-- Rodada 1: Bélgica vs Egito | Irã vs Nova Zelândia
-- Rodada 2: Bélgica vs Nova Zelândia | Egito vs Irã
-- Rodada 3: Bélgica vs Irã | Egito vs Nova Zelândia

-- ---- GRUPO H ----
-- Rodada 1: Espanha vs Cabo Verde | Arábia Saudita vs Uruguai
-- Rodada 2: Espanha vs Uruguai | Cabo Verde vs Arábia Saudita
-- Rodada 3: Espanha vs Arábia Saudita | Cabo Verde vs Uruguai

-- ---- GRUPO I ----
-- Rodada 1: França vs Senegal | Iraque vs Noruega
-- Rodada 2: França vs Noruega | Senegal vs Iraque
-- Rodada 3: França vs Iraque | Senegal vs Noruega

-- ---- GRUPO J ----
-- Rodada 1: Argentina vs Argélia | Áustria vs Jordânia
-- Rodada 2: Argentina vs Jordânia | Argélia vs Áustria
-- Rodada 3: Argentina vs Áustria | Argélia vs Jordânia

-- ---- GRUPO K ----
-- Rodada 1: Colômbia vs Uzbequistão | Portugal vs RD Congo
-- Rodada 2: Colômbia vs RD Congo | Portugal vs Uzbequistão
-- Rodada 3: Colômbia vs Portugal | Uzbequistão vs RD Congo

-- ---- GRUPO L ----
-- Rodada 1: Inglaterra vs Croácia | Gana vs Panamá
-- Rodada 2: Inglaterra vs Panamá | Croácia vs Gana
-- Rodada 3: Inglaterra vs Gana | Croácia vs Panamá
