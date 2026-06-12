-- ============================================================
-- Rollback de todos os cutoffs
-- Remove todos os cutoff_at das partidas
-- Execute no Supabase SQL Editor (Settings > SQL Editor)
-- ============================================================

-- Reseta todos os cutoff_at para NULL
UPDATE matches
SET cutoff_at = NULL
WHERE cutoff_at IS NOT NULL;

-- Resetar cutoff_at para 2 horas antes do kickoff_at
UPDATE games SET cutoff_at = kickoff_at - INTERVAL '2 hours';

-- Confirma a operação
SELECT COUNT(*) as total_matches_updated
FROM matches
WHERE cutoff_at IS NULL;
