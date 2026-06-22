CREATE OR REPLACE FUNCTION get_predictions_report(p_pool_id uuid)
RETURNS TABLE (
  kickoff_at     timestamptz,
  round_name     text,
  home_team      text,
  away_team      text,
  participant    text,
  home_guess     integer,
  away_guess     integer,
  points         integer,
  status         text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
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
  WHERE m.status = 'encerrado'
    AND r.pool_id  = p_pool_id
  ORDER BY m.kickoff_at, ht.name, pred.points DESC NULLS LAST, prof.name;
$$;

GRANT EXECUTE ON FUNCTION get_predictions_report(uuid) TO authenticated;
