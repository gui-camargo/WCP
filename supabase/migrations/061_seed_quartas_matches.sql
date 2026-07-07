-- Cria o round Quartas de Final e semeia os 4 jogos com placeholder 'A Definir'.
-- Rodar 062_set_quartas_confirmed_teams.sql depois para preencher os times confirmados.
-- Horários convertidos de Brasília (BRT = UTC-3) para UTC.

DO $$
DECLARE
  v_pool_id  UUID;
  v_team_id  UUID;
  v_round_id UUID;
BEGIN
  SELECT id INTO v_pool_id FROM pools WHERE is_default_global = true LIMIT 1;
  SELECT id INTO v_team_id FROM teams WHERE name = 'A Definir' LIMIT 1;

  IF v_pool_id IS NULL THEN RAISE NOTICE 'Pool padrão não encontrado.'; RETURN; END IF;
  IF v_team_id IS NULL THEN RAISE NOTICE 'Time A Definir não encontrado — rode 054 primeiro.'; RETURN; END IF;

  INSERT INTO rounds (pool_id, name, phase)
    VALUES (v_pool_id, 'Quartas de Final', 'quartas')
    RETURNING id INTO v_round_id;

  INSERT INTO matches (round_id, home_team_id, away_team_id, kickoff_at, cutoff_at, venue)
  VALUES
    -- Qui 09/jul | 17h BRT | França x Marrocos
    (v_round_id, v_team_id, v_team_id, '2026-07-09 20:00:00+00', '2026-07-09 19:30:00+00', ''),
    -- Sex 10/jul | 16h BRT | Espanha x Bélgica
    (v_round_id, v_team_id, v_team_id, '2026-07-10 19:00:00+00', '2026-07-10 18:30:00+00', ''),
    -- Sáb 11/jul | 18h BRT | Noruega x Inglaterra
    (v_round_id, v_team_id, v_team_id, '2026-07-11 21:00:00+00', '2026-07-11 20:30:00+00', ''),
    -- Sáb 11/jul | 22h BRT | Argentina ou Egito x Suíça ou Colômbia (não definido)
    (v_round_id, v_team_id, v_team_id, '2026-07-12 01:00:00+00', '2026-07-12 00:30:00+00', '');

  RAISE NOTICE 'Round quartas criado: %', v_round_id;
END $$;
