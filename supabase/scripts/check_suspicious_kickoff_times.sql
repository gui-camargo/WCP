-- Diagnóstico: jogos com horários BRT suspeitos
-- Foco em horários entre 20h e 03h (janela onde erros de fuso são mais comuns)
-- Compare a coluna kickoff_brt com o horário oficial da Copa para identificar erros

SELECT
  m.id,
  ht.name                                                        AS home_team,
  at_.name                                                       AS away_team,
  m.kickoff_at                                                   AS kickoff_utc,
  (m.kickoff_at AT TIME ZONE 'America/Sao_Paulo')::timestamp     AS kickoff_brt,
  EXTRACT(HOUR FROM m.kickoff_at AT TIME ZONE 'America/Sao_Paulo')::int AS hora_brt,
  -- Possíveis correções para referência
  ((m.kickoff_at + INTERVAL '2 hours') AT TIME ZONE 'America/Sao_Paulo')::timestamp  AS se_faltou_2h,
  ((m.kickoff_at + INTERVAL '3 hours') AT TIME ZONE 'America/Sao_Paulo')::timestamp  AS se_faltou_3h,
  ((m.kickoff_at + INTERVAL '1 day')   AT TIME ZONE 'America/Sao_Paulo')::timestamp  AS se_faltou_1dia
FROM matches m
JOIN teams ht  ON ht.id  = m.home_team_id
JOIN teams at_ ON at_.id = m.away_team_id
WHERE m.status != 'encerrado'
  AND (
    EXTRACT(HOUR FROM m.kickoff_at AT TIME ZONE 'America/Sao_Paulo') >= 20
    OR EXTRACT(HOUR FROM m.kickoff_at AT TIME ZONE 'America/Sao_Paulo') <= 3
  )
ORDER BY kickoff_brt;
