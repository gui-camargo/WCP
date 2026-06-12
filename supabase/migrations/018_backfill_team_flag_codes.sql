-- ============================================================
-- WCP – Migration 018
-- Backfill/update flag_code for all teams
-- ============================================================

UPDATE public.teams t
SET flag_code = v.flag_code
FROM (VALUES
  ('México', 'MX'),('África do Sul', 'ZA'),('Coreia do Sul', 'KR'),('República Tcheca', 'CZ'),
  ('Canadá', 'CA'),('Bósnia e Herzegovina', 'BA'),('Catar', 'QA'),('Suíça', 'CH'),
  ('Brasil', 'BR'),('Marrocos', 'MA'),('Haiti', 'HT'),('Escócia', 'GB-SCT'),
  ('Estados Unidos', 'US'),('Paraguai', 'PY'),('Austrália', 'AU'),('Turquia', 'TR'),
  ('Alemanha', 'DE'),('Curaçao', 'CW'),('Costa do Marfim', 'CI'),('Equador', 'EC'),
  ('Holanda', 'NL'),('Japão', 'JP'),('Suécia', 'SE'),('Tunísia', 'TN'),
  ('Bélgica', 'BE'),('Egito', 'EG'),('Irã', 'IR'),('Nova Zelândia', 'NZ'),
  ('Espanha', 'ES'),('Cabo Verde', 'CV'),('Arábia Saudita', 'SA'),('Uruguai', 'UY'),
  ('França', 'FR'),('Senegal', 'SN'),('Iraque', 'IQ'),('Noruega', 'NO'),
  ('Argentina', 'AR'),('Argélia', 'DZ'),('Áustria', 'AT'),('Jordânia', 'JO'),
  ('Colômbia', 'CO'),('Uzbequistão', 'UZ'),('Portugal', 'PT'),('RD Congo', 'CD'),
  ('Inglaterra', 'GB-ENG'),('Croácia', 'HR'),('Gana', 'GH'),('Panamá', 'PA')
) AS v(name, flag_code)
WHERE t.name = v.name;
