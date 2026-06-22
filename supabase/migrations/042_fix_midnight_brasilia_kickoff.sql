-- Fix: Turquia x Paraguai estava com kickoff_at um dia antes do correto
-- De: 2026-06-19 00:00 BRT  →  Para: 2026-06-20 00:00 BRT

UPDATE matches
SET
  kickoff_at = kickoff_at + INTERVAL '1 day',
  cutoff_at  = CASE
                 WHEN cutoff_at IS NOT NULL THEN cutoff_at + INTERVAL '1 day'
                 ELSE NULL
               END
WHERE id = 'fff4748e-4711-4fd4-8f03-20d3aecdda42';
