-- Preenche os times já confirmados nas oitavas de final.
-- Times com adversário ainda indefinido (A Definir) ficam sem alteração no away/home.

DO $$
DECLARE
  v_round_id UUID;
  v_canada   UUID;
  v_marrocos UUID;
  v_paraguai UUID;
  v_franca   UUID;
  v_brasil   UUID;
  v_noruega  UUID;
  v_mexico     UUID;
  v_inglaterra UUID;
BEGIN
  SELECT r.id INTO v_round_id
    FROM rounds r
    JOIN pools p ON p.id = r.pool_id
    WHERE r.phase = 'oitavas'
      AND p.is_default_global = true
    LIMIT 1;

  IF v_round_id IS NULL THEN RAISE NOTICE 'Round oitavas não encontrado.'; RETURN; END IF;

  SELECT id INTO v_canada   FROM teams WHERE name ILIKE '%Canad%'   LIMIT 1;
  SELECT id INTO v_marrocos FROM teams WHERE name ILIKE 'Marrocos'  LIMIT 1;
  SELECT id INTO v_paraguai FROM teams WHERE name ILIKE 'Paraguai'  LIMIT 1;
  SELECT id INTO v_franca   FROM teams WHERE name ILIKE 'França'    LIMIT 1;
  SELECT id INTO v_brasil   FROM teams WHERE name ILIKE 'Brasil'    LIMIT 1;
  SELECT id INTO v_noruega  FROM teams WHERE name ILIKE 'Noruega'   LIMIT 1;
  SELECT id INTO v_mexico     FROM teams WHERE name ILIKE 'México'     LIMIT 1;
  SELECT id INTO v_inglaterra FROM teams WHERE name ILIKE 'Inglaterra' LIMIT 1;

  IF v_canada     IS NULL THEN RAISE NOTICE 'Não encontrado: Canadá';     END IF;
  IF v_marrocos   IS NULL THEN RAISE NOTICE 'Não encontrado: Marrocos';   END IF;
  IF v_paraguai   IS NULL THEN RAISE NOTICE 'Não encontrado: Paraguai';   END IF;
  IF v_franca     IS NULL THEN RAISE NOTICE 'Não encontrado: França';     END IF;
  IF v_brasil     IS NULL THEN RAISE NOTICE 'Não encontrado: Brasil';     END IF;
  IF v_noruega    IS NULL THEN RAISE NOTICE 'Não encontrado: Noruega';    END IF;
  IF v_mexico     IS NULL THEN RAISE NOTICE 'Não encontrado: México';     END IF;
  IF v_inglaterra IS NULL THEN RAISE NOTICE 'Não encontrado: Inglaterra'; END IF;

  -- Sáb 04/jul 17:00 UTC | Canadá x Marrocos
  UPDATE matches SET home_team_id = v_canada, away_team_id = v_marrocos
    WHERE round_id = v_round_id AND kickoff_at = '2026-07-04 17:00:00+00';

  -- Sáb 04/jul 21:00 UTC | Paraguai x França
  UPDATE matches SET home_team_id = v_paraguai, away_team_id = v_franca
    WHERE round_id = v_round_id AND kickoff_at = '2026-07-04 21:00:00+00';

  -- Dom 05/jul 20:00 UTC | Brasil x Noruega
  UPDATE matches SET home_team_id = v_brasil, away_team_id = v_noruega
    WHERE round_id = v_round_id AND kickoff_at = '2026-07-05 20:00:00+00';

  -- Dom 05/jul 21h BRT → 06/jul 00:00 UTC | México x Inglaterra
  UPDATE matches SET home_team_id = v_mexico, away_team_id = v_inglaterra
    WHERE round_id = v_round_id AND kickoff_at = '2026-07-06 00:00:00+00';

END $$;
