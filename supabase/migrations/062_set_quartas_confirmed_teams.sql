-- Preenche os times já confirmados nas quartas de final.
-- O jogo entre Argentina ou Egito x Suíça ou Colômbia ainda não está definido e fica sem alteração.

DO $$
DECLARE
  v_round_id    UUID;
  v_franca      UUID;
  v_marrocos    UUID;
  v_espanha     UUID;
  v_belgica     UUID;
  v_noruega     UUID;
  v_inglaterra  UUID;
BEGIN
  SELECT r.id INTO v_round_id
    FROM rounds r
    JOIN pools p ON p.id = r.pool_id
    WHERE r.phase = 'quartas'
      AND p.is_default_global = true
    LIMIT 1;

  IF v_round_id IS NULL THEN RAISE NOTICE 'Round quartas não encontrado.'; RETURN; END IF;

  SELECT id INTO v_franca     FROM teams WHERE name ILIKE 'França'     LIMIT 1;
  SELECT id INTO v_marrocos   FROM teams WHERE name ILIKE 'Marrocos'   LIMIT 1;
  SELECT id INTO v_espanha    FROM teams WHERE name ILIKE 'Espanha'    LIMIT 1;
  SELECT id INTO v_belgica    FROM teams WHERE name ILIKE 'Bélgica'    LIMIT 1;
  SELECT id INTO v_noruega    FROM teams WHERE name ILIKE 'Noruega'    LIMIT 1;
  SELECT id INTO v_inglaterra FROM teams WHERE name ILIKE 'Inglaterra' LIMIT 1;

  IF v_franca     IS NULL THEN RAISE NOTICE 'Não encontrado: França';     END IF;
  IF v_marrocos   IS NULL THEN RAISE NOTICE 'Não encontrado: Marrocos';   END IF;
  IF v_espanha    IS NULL THEN RAISE NOTICE 'Não encontrado: Espanha';    END IF;
  IF v_belgica    IS NULL THEN RAISE NOTICE 'Não encontrado: Bélgica';    END IF;
  IF v_noruega    IS NULL THEN RAISE NOTICE 'Não encontrado: Noruega';    END IF;
  IF v_inglaterra IS NULL THEN RAISE NOTICE 'Não encontrado: Inglaterra'; END IF;

  -- Qui 09/jul 20:00 UTC (17h BRT) | França x Marrocos
  UPDATE matches SET home_team_id = v_franca, away_team_id = v_marrocos
    WHERE round_id = v_round_id AND kickoff_at = '2026-07-09 20:00:00+00';

  -- Sex 10/jul 19:00 UTC (16h BRT) | Espanha x Bélgica
  UPDATE matches SET home_team_id = v_espanha, away_team_id = v_belgica
    WHERE round_id = v_round_id AND kickoff_at = '2026-07-10 19:00:00+00';

  -- Sáb 11/jul 21:00 UTC (18h BRT) | Noruega x Inglaterra
  UPDATE matches SET home_team_id = v_noruega, away_team_id = v_inglaterra
    WHERE round_id = v_round_id AND kickoff_at = '2026-07-11 21:00:00+00';

END $$;
