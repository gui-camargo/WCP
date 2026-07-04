-- Semeia os 16 jogos das dezesseistavas de final com time placeholder "A Definir".
-- Admin deve atualizar home_team_id/away_team_id via Supabase conforme os classificados forem definidos.
-- Horários convertidos de Brasília (BRT = UTC-3) para UTC.

INSERT INTO teams (name, flag_code)
VALUES ('A Definir', null)
ON CONFLICT (name) DO NOTHING;

DO $$
DECLARE
  v_pool_id   UUID;
  v_team_id   UUID;
  v_round_id  UUID;
BEGIN
  SELECT id INTO v_pool_id FROM pools WHERE is_default_global = true LIMIT 1;
  IF v_pool_id IS NULL THEN
    RAISE NOTICE 'Nenhum pool padrão encontrado. Pulando seed de dezesseistavas.';
    RETURN;
  END IF;

  SELECT id INTO v_team_id FROM teams WHERE name = 'A Definir' LIMIT 1;

  INSERT INTO rounds (pool_id, name, phase)
    VALUES (v_pool_id, 'Dezesseistavas de Final', 'dezesseis_avos')
    RETURNING id INTO v_round_id;

  INSERT INTO matches (round_id, home_team_id, away_team_id, kickoff_at, venue) VALUES
    -- 28/jun domingo
    (v_round_id, v_team_id, v_team_id, '2026-06-28 19:00:00+00', 'Los Angeles'),           -- 16h BRT | 2ºA x 2ºB
    -- 29/jun segunda
    (v_round_id, v_team_id, v_team_id, '2026-06-29 17:00:00+00', 'Houston'),               -- 14h BRT | 1ºC x 2ºF
    (v_round_id, v_team_id, v_team_id, '2026-06-29 20:30:00+00', 'Boston'),                -- 17h30 BRT | 1ºE x 3º melhor (A/B/C/D/F)
    (v_round_id, v_team_id, v_team_id, '2026-06-30 01:00:00+00', 'Monterrey'),             -- 22h BRT | 1ºF x 2ºC
    -- 30/jun terça
    (v_round_id, v_team_id, v_team_id, '2026-06-30 17:00:00+00', 'Dallas'),                -- 14h BRT | 2ºE x 2ºI
    (v_round_id, v_team_id, v_team_id, '2026-06-30 21:00:00+00', 'Nova York/Nova Jersey'), -- 18h BRT | 1ºI x 3º melhor (C/D/F/G/H)
    (v_round_id, v_team_id, v_team_id, '2026-07-01 01:00:00+00', 'Cidade do México'),      -- 22h BRT | 1ºA x 3º melhor (C/E/F/H/I)
    -- 01/jul quarta
    (v_round_id, v_team_id, v_team_id, '2026-07-01 16:00:00+00', 'Atlanta'),               -- 13h BRT | 1ºL x 3º melhor (E/H/I/J/K)
    (v_round_id, v_team_id, v_team_id, '2026-07-01 20:00:00+00', 'Seattle'),               -- 17h BRT | 1ºG x 3º melhor (A/E/H/I/J)
    (v_round_id, v_team_id, v_team_id, '2026-07-02 00:00:00+00', 'Santa Clara'),           -- 21h BRT | 1ºD x 3º melhor (B/E/F/I/J)
    -- 02/jul quinta
    (v_round_id, v_team_id, v_team_id, '2026-07-02 19:00:00+00', 'Los Angeles'),           -- 16h BRT | 1ºH x 2ºJ
    (v_round_id, v_team_id, v_team_id, '2026-07-02 23:00:00+00', 'Toronto'),               -- 20h BRT | 2ºK x 2ºL
    -- 03/jul sexta
    (v_round_id, v_team_id, v_team_id, '2026-07-03 03:00:00+00', 'Vancouver'),             -- 00h BRT | 1ºB x 3º melhor (E/F/G/I/J)
    (v_round_id, v_team_id, v_team_id, '2026-07-03 18:00:00+00', 'Dallas'),                -- 15h BRT | 1ºD x 2ºG
    (v_round_id, v_team_id, v_team_id, '2026-07-03 22:00:00+00', 'Miami'),                 -- 19h BRT | 1ºJ x 2ºH
    (v_round_id, v_team_id, v_team_id, '2026-07-04 01:30:00+00', 'Kansas City');           -- 22h30 BRT | 1ºK x 3º melhor (D/E/I/J/L)
END $$;
