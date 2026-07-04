-- Define os times confirmados em todos os 16 jogos das dezesseistavas.
-- O bloqueio de palpites é feito na UI (RodadaPage verifica nome 'A Definir').
-- ATENÇÃO: verifique os NOTICEs para times não encontrados pelo nome.

DO $$
DECLARE
  v_round_id   UUID;
  v_africa_sul UUID;
  v_canada     UUID;
  v_brasil     UUID;
  v_japao      UUID;
  v_alemanha   UUID;
  v_paraguai   UUID;
  v_holanda    UUID;
  v_marrocos   UUID;
  v_marfim     UUID;
  v_noruega    UUID;
  v_franca     UUID;
  v_suecia     UUID;
  v_mexico     UUID;
  v_equador    UUID;
  v_inglaterra UUID;
  v_congo      UUID;
  v_belgica    UUID;
  v_senegal    UUID;
  v_eua        UUID;
  v_bosnia     UUID;
  v_espanha    UUID;
  v_austria    UUID;
  v_portugal   UUID;
  v_croacia    UUID;
  v_suica      UUID;
  v_argelia    UUID;
  v_australia  UUID;
  v_egito      UUID;
  v_argentina  UUID;
  v_cabo_verde UUID;
  v_colombia   UUID;
  v_gana       UUID;
BEGIN
  SELECT r.id INTO v_round_id
    FROM rounds r
    JOIN pools p ON p.id = r.pool_id
    WHERE r.phase = 'dezesseis_avos'
      AND p.is_default_global = true
    LIMIT 1;

  IF v_round_id IS NULL THEN
    RAISE NOTICE 'Round dezesseis_avos não encontrado.';
    RETURN;
  END IF;

  SELECT id INTO v_africa_sul FROM teams WHERE name ILIKE '%África do Sul%'            LIMIT 1;
  SELECT id INTO v_canada     FROM teams WHERE name ILIKE '%Canad%'                    LIMIT 1;
  SELECT id INTO v_brasil     FROM teams WHERE name ILIKE 'Brasil'                     LIMIT 1;
  SELECT id INTO v_japao      FROM teams WHERE name ILIKE 'Japão'                      LIMIT 1;
  SELECT id INTO v_alemanha   FROM teams WHERE name ILIKE 'Alemanha'                   LIMIT 1;
  SELECT id INTO v_paraguai   FROM teams WHERE name ILIKE 'Paraguai'                   LIMIT 1;
  SELECT id INTO v_holanda    FROM teams WHERE name ILIKE '%Holanda%' OR name ILIKE '%Países Baixos%' LIMIT 1;
  SELECT id INTO v_marrocos   FROM teams WHERE name ILIKE 'Marrocos'                   LIMIT 1;
  SELECT id INTO v_marfim     FROM teams WHERE name ILIKE '%Marfim%'                   LIMIT 1;
  SELECT id INTO v_noruega    FROM teams WHERE name ILIKE 'Noruega'                    LIMIT 1;
  SELECT id INTO v_franca     FROM teams WHERE name ILIKE 'França'                     LIMIT 1;
  SELECT id INTO v_suecia     FROM teams WHERE name ILIKE 'Suécia'                     LIMIT 1;
  SELECT id INTO v_mexico     FROM teams WHERE name ILIKE 'México'                     LIMIT 1;
  SELECT id INTO v_equador    FROM teams WHERE name ILIKE 'Equador'                    LIMIT 1;
  SELECT id INTO v_inglaterra FROM teams WHERE name ILIKE 'Inglaterra'                 LIMIT 1;
  SELECT id INTO v_congo      FROM teams WHERE name ILIKE '%Congo%'                    LIMIT 1;
  SELECT id INTO v_belgica    FROM teams WHERE name ILIKE 'Bélgica'                    LIMIT 1;
  SELECT id INTO v_senegal    FROM teams WHERE name ILIKE 'Senegal'                    LIMIT 1;
  SELECT id INTO v_eua        FROM teams WHERE name ILIKE '%Estados Unidos%'           LIMIT 1;
  SELECT id INTO v_bosnia     FROM teams WHERE name ILIKE 'Bósnia%' OR name ILIKE 'Bosnia%' LIMIT 1;
  SELECT id INTO v_espanha    FROM teams WHERE name ILIKE 'Espanha'                    LIMIT 1;
  SELECT id INTO v_austria    FROM teams WHERE name ILIKE 'Áustria'                    LIMIT 1;
  SELECT id INTO v_portugal   FROM teams WHERE name ILIKE 'Portugal'                   LIMIT 1;
  SELECT id INTO v_croacia    FROM teams WHERE name ILIKE 'Croácia'                    LIMIT 1;
  SELECT id INTO v_suica      FROM teams WHERE name ILIKE 'Suíça'                      LIMIT 1;
  SELECT id INTO v_argelia    FROM teams WHERE name ILIKE 'Argélia'                    LIMIT 1;
  SELECT id INTO v_australia  FROM teams WHERE name ILIKE 'Austrália'                  LIMIT 1;
  SELECT id INTO v_egito      FROM teams WHERE name ILIKE 'Egito'                      LIMIT 1;
  SELECT id INTO v_argentina  FROM teams WHERE name ILIKE 'Argentina'                  LIMIT 1;
  SELECT id INTO v_cabo_verde FROM teams WHERE name ILIKE 'Cabo Verde'                 LIMIT 1;
  SELECT id INTO v_colombia   FROM teams WHERE name ILIKE 'Colômbia'                   LIMIT 1;
  SELECT id INTO v_gana       FROM teams WHERE name ILIKE 'Gana'                       LIMIT 1;

  IF v_africa_sul IS NULL THEN RAISE NOTICE 'Não encontrado: África do Sul'; END IF;
  IF v_canada     IS NULL THEN RAISE NOTICE 'Não encontrado: Canadá'; END IF;
  IF v_brasil     IS NULL THEN RAISE NOTICE 'Não encontrado: Brasil'; END IF;
  IF v_japao      IS NULL THEN RAISE NOTICE 'Não encontrado: Japão'; END IF;
  IF v_alemanha   IS NULL THEN RAISE NOTICE 'Não encontrado: Alemanha'; END IF;
  IF v_paraguai   IS NULL THEN RAISE NOTICE 'Não encontrado: Paraguai'; END IF;
  IF v_holanda    IS NULL THEN RAISE NOTICE 'Não encontrado: Holanda / Países Baixos'; END IF;
  IF v_marrocos   IS NULL THEN RAISE NOTICE 'Não encontrado: Marrocos'; END IF;
  IF v_marfim     IS NULL THEN RAISE NOTICE 'Não encontrado: Costa do Marfim'; END IF;
  IF v_noruega    IS NULL THEN RAISE NOTICE 'Não encontrado: Noruega'; END IF;
  IF v_franca     IS NULL THEN RAISE NOTICE 'Não encontrado: França'; END IF;
  IF v_suecia     IS NULL THEN RAISE NOTICE 'Não encontrado: Suécia'; END IF;
  IF v_mexico     IS NULL THEN RAISE NOTICE 'Não encontrado: México'; END IF;
  IF v_equador    IS NULL THEN RAISE NOTICE 'Não encontrado: Equador'; END IF;
  IF v_inglaterra IS NULL THEN RAISE NOTICE 'Não encontrado: Inglaterra'; END IF;
  IF v_congo      IS NULL THEN RAISE NOTICE 'Não encontrado: Congo'; END IF;
  IF v_belgica    IS NULL THEN RAISE NOTICE 'Não encontrado: Bélgica'; END IF;
  IF v_senegal    IS NULL THEN RAISE NOTICE 'Não encontrado: Senegal'; END IF;
  IF v_eua        IS NULL THEN RAISE NOTICE 'Não encontrado: Estados Unidos'; END IF;
  IF v_bosnia     IS NULL THEN RAISE NOTICE 'Não encontrado: Bósnia'; END IF;
  IF v_espanha    IS NULL THEN RAISE NOTICE 'Não encontrado: Espanha'; END IF;
  IF v_austria    IS NULL THEN RAISE NOTICE 'Não encontrado: Áustria'; END IF;
  IF v_portugal   IS NULL THEN RAISE NOTICE 'Não encontrado: Portugal'; END IF;
  IF v_croacia    IS NULL THEN RAISE NOTICE 'Não encontrado: Croácia'; END IF;
  IF v_suica      IS NULL THEN RAISE NOTICE 'Não encontrado: Suíça'; END IF;
  IF v_argelia    IS NULL THEN RAISE NOTICE 'Não encontrado: Argélia'; END IF;
  IF v_australia  IS NULL THEN RAISE NOTICE 'Não encontrado: Austrália'; END IF;
  IF v_egito      IS NULL THEN RAISE NOTICE 'Não encontrado: Egito'; END IF;
  IF v_argentina  IS NULL THEN RAISE NOTICE 'Não encontrado: Argentina'; END IF;
  IF v_cabo_verde IS NULL THEN RAISE NOTICE 'Não encontrado: Cabo Verde'; END IF;
  IF v_colombia   IS NULL THEN RAISE NOTICE 'Não encontrado: Colômbia'; END IF;
  IF v_gana       IS NULL THEN RAISE NOTICE 'Não encontrado: Gana'; END IF;

  -- 28/jun 19:00 UTC | Los Angeles (16h BRT): África do Sul x Canadá
  UPDATE matches SET home_team_id = v_africa_sul, away_team_id = v_canada
    WHERE round_id = v_round_id AND kickoff_at = '2026-06-28 19:00:00+00';

  -- 29/jun 17:00 UTC | Houston (14h BRT): Brasil x Japão
  UPDATE matches SET home_team_id = v_brasil, away_team_id = v_japao
    WHERE round_id = v_round_id AND kickoff_at = '2026-06-29 17:00:00+00';

  -- 29/jun 20:30 UTC | Boston (17h30 BRT): Alemanha x Paraguai
  UPDATE matches SET home_team_id = v_alemanha, away_team_id = v_paraguai
    WHERE round_id = v_round_id AND kickoff_at = '2026-06-29 20:30:00+00';

  -- 30/jun 01:00 UTC | Monterrey (22h BRT 29/jun): Holanda x Marrocos
  UPDATE matches SET home_team_id = v_holanda, away_team_id = v_marrocos
    WHERE round_id = v_round_id AND kickoff_at = '2026-06-30 01:00:00+00';

  -- 30/jun 17:00 UTC | Dallas (14h BRT): Costa do Marfim x Noruega
  UPDATE matches SET home_team_id = v_marfim, away_team_id = v_noruega
    WHERE round_id = v_round_id AND kickoff_at = '2026-06-30 17:00:00+00';

  -- 30/jun 21:00 UTC | Nova York (18h BRT): França x Suécia
  UPDATE matches SET home_team_id = v_franca, away_team_id = v_suecia
    WHERE round_id = v_round_id AND kickoff_at = '2026-06-30 21:00:00+00';

  -- 01/jul 01:00 UTC | Cidade do México (22h BRT 30/jun): México x Equador
  UPDATE matches SET home_team_id = v_mexico, away_team_id = v_equador
    WHERE round_id = v_round_id AND kickoff_at = '2026-07-01 01:00:00+00';

  -- 01/jul 16:00 UTC | Atlanta (13h BRT): Inglaterra x Congo
  UPDATE matches SET home_team_id = v_inglaterra, away_team_id = v_congo
    WHERE round_id = v_round_id AND kickoff_at = '2026-07-01 16:00:00+00';

  -- 01/jul 20:00 UTC | Seattle (17h BRT): Bélgica x Senegal
  UPDATE matches SET home_team_id = v_belgica, away_team_id = v_senegal
    WHERE round_id = v_round_id AND kickoff_at = '2026-07-01 20:00:00+00';

  -- 02/jul 00:00 UTC | Santa Clara (21h BRT 01/jul): Estados Unidos x Bósnia
  UPDATE matches SET home_team_id = v_eua, away_team_id = v_bosnia
    WHERE round_id = v_round_id AND kickoff_at = '2026-07-02 00:00:00+00';

  -- 02/jul 19:00 UTC | Los Angeles (16h BRT): Espanha x Áustria
  UPDATE matches SET home_team_id = v_espanha, away_team_id = v_austria
    WHERE round_id = v_round_id AND kickoff_at = '2026-07-02 19:00:00+00';

  -- 02/jul 23:00 UTC | Toronto (20h BRT): Portugal x Croácia
  UPDATE matches SET home_team_id = v_portugal, away_team_id = v_croacia
    WHERE round_id = v_round_id AND kickoff_at = '2026-07-02 23:00:00+00';

  -- 03/jul 03:00 UTC | Vancouver (00h BRT): Suíça x Argélia
  UPDATE matches SET home_team_id = v_suica, away_team_id = v_argelia
    WHERE round_id = v_round_id AND kickoff_at = '2026-07-03 03:00:00+00';

  -- 03/jul 18:00 UTC | Dallas (15h BRT): Austrália x Egito
  UPDATE matches SET home_team_id = v_australia, away_team_id = v_egito
    WHERE round_id = v_round_id AND kickoff_at = '2026-07-03 18:00:00+00';

  -- 03/jul 22:00 UTC | Miami (19h BRT): Argentina x Cabo Verde
  UPDATE matches SET home_team_id = v_argentina, away_team_id = v_cabo_verde
    WHERE round_id = v_round_id AND kickoff_at = '2026-07-03 22:00:00+00';

  -- 04/jul 01:30 UTC | Kansas City (22h30 BRT 03/jul): Colômbia x Gana
  UPDATE matches SET home_team_id = v_colombia, away_team_id = v_gana
    WHERE round_id = v_round_id AND kickoff_at = '2026-07-04 01:30:00+00';

END $$;
