CREATE OR REPLACE VIEW vw_predictions_report AS
SELECT
  r.pool_id,
  m.id            AS match_id,
  m.kickoff_at,
  r.name          AS round_name,
  ht.name         AS home_team,
  at.name         AS away_team,
  prof.name       AS participant,
  pred.home_guess,
  pred.away_guess,
  pred.points,
  CASE
    WHEN pred.created_at > m.kickoff_at THEN 'Nao palpitou'
    ELSE 'Palpitou'
  END             AS status
FROM matches m
JOIN rounds      r    ON r.id    = m.round_id
JOIN teams       ht   ON ht.id   = m.home_team_id
JOIN teams       at   ON at.id   = m.away_team_id
JOIN predictions pred ON pred.match_id = m.id
JOIN profiles    prof ON prof.id = pred.user_id
WHERE m.status = 'encerrado';

GRANT SELECT ON vw_predictions_report TO authenticated;
