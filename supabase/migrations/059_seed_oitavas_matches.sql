-- Cria o round Oitavas de Final e semeia os 8 jogos com placeholder 'A Definir'.
-- Rodar 060_set_oitavas_confirmed_teams.sql depois para preencher os times confirmados.

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
    VALUES (v_pool_id, 'Oitavas de Final', 'oitavas')
    RETURNING id INTO v_round_id;

  INSERT INTO matches (round_id, home_team_id, away_team_id, kickoff_at, cutoff_at, venue)
  VALUES
    -- Sáb 04/jul
    (v_round_id, v_team_id, v_team_id, '2026-07-04 17:00:00+00', '2026-07-04 16:30:00+00', ''),
    (v_round_id, v_team_id, v_team_id, '2026-07-04 21:00:00+00', '2026-07-04 20:30:00+00', ''),
    -- Dom 05/jul
    (v_round_id, v_team_id, v_team_id, '2026-07-05 20:00:00+00', '2026-07-05 19:30:00+00', ''),
    (v_round_id, v_team_id, v_team_id, '2026-07-06 00:00:00+00', '2026-07-05 23:30:00+00', ''),
    -- Seg 06/jul
    (v_round_id, v_team_id, v_team_id, '2026-07-06 19:00:00+00', '2026-07-06 18:30:00+00', ''),
    (v_round_id, v_team_id, v_team_id, '2026-07-07 00:00:00+00', '2026-07-06 23:30:00+00', ''),
    -- Ter 07/jul
    (v_round_id, v_team_id, v_team_id, '2026-07-07 16:00:00+00', '2026-07-07 15:30:00+00', ''),
    (v_round_id, v_team_id, v_team_id, '2026-07-07 20:00:00+00', '2026-07-07 19:30:00+00', '');

  RAISE NOTICE 'Round oitavas criado: %', v_round_id;
END $$;
