-- ============================================================
-- WCP – Bolão Copa do Mundo
-- Migration 002 – Seed: Times e Grupos (A–L)
-- Execute APÓS a migration 001
-- ============================================================

-- ==================== GRUPOS ====================
INSERT INTO groups (code) VALUES
  ('A'),('B'),('C'),('D'),('E'),('F'),
  ('G'),('H'),('I'),('J'),('K'),('L')
ON CONFLICT (code) DO NOTHING;

-- ==================== TIMES ====================
INSERT INTO teams (name, flag_code) VALUES
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
ON CONFLICT (name) DO UPDATE SET flag_code = EXCLUDED.flag_code;

-- ============================================================
-- NOTA: As partidas são inseridas POR BOLÃO, pois cada bolão
-- tem suas próprias rounds (com pool_id). Use o script abaixo
-- como referência e substitua <POOL_ID> e <ROUND_IDs> pelos
-- valores reais do seu Supabase após criar o bolão e as rodadas.
--
-- Estrutura de rodadas sugerida por grupo (3 rodadas por grupo):
--   Grupo X – Rodada 1 | Fase: grupos
--   Grupo X – Rodada 2 | Fase: grupos
--   Grupo X – Rodada 3 | Fase: grupos
--
-- Após criadas as rounds, insira as matches com:
--   INSERT INTO matches (round_id, group_id, home_team_id, away_team_id, kickoff_at)
--   SELECT <round_id>,
--          (SELECT id FROM groups WHERE code = 'A'),
--          (SELECT id FROM teams WHERE name = 'México'),
--          (SELECT id FROM teams WHERE name = 'África do Sul'),
--          '2026-06-01 15:00:00+00'
-- ============================================================

-- ==================== HELPER VIEW (referência de times+grupos) ====================
-- Mostra os IDs para facilitar a inserção manual de partidas
CREATE OR REPLACE VIEW team_ref AS
SELECT t.name AS team, t.id AS team_id FROM teams t ORDER BY t.name;

CREATE OR REPLACE VIEW group_ref AS
SELECT g.code, g.id FROM groups g ORDER BY g.code;
