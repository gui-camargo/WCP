-- Corrige cutoff_at dos jogos das dezesseistavas para 30 minutos antes do kickoff.
-- Os kickoff_at já foram corrigidos anteriormente; este script apenas recalcula os cutoffs.

UPDATE matches
SET cutoff_at = kickoff_at - INTERVAL '30 minutes'
WHERE round_id = (
  SELECT r.id
  FROM rounds r
  JOIN pools p ON p.id = r.pool_id
  WHERE r.phase = 'dezesseis_avos'
    AND p.is_default_global = true
  LIMIT 1
);
