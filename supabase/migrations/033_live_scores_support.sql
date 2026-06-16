-- ============================================================
-- WCP – Migration 033
-- Add live score support: ao_vivo status + external match columns
-- ============================================================

-- Expand status CHECK constraint to include 'ao_vivo'
DO $$
DECLARE
  c text;
BEGIN
  SELECT conname INTO c
  FROM pg_constraint
  WHERE conrelid = 'matches'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%status%';
  IF c IS NOT NULL THEN
    EXECUTE 'ALTER TABLE matches DROP CONSTRAINT ' || quote_ident(c);
  END IF;
END$$;

ALTER TABLE matches
  ADD CONSTRAINT matches_status_check
  CHECK (status IN ('pendente', 'ao_vivo', 'encerrado'));

-- New columns for external API integration
ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS external_match_id integer,
  ADD COLUMN IF NOT EXISTS home_win_pct      integer,
  ADD COLUMN IF NOT EXISTS draw_pct          integer,
  ADD COLUMN IF NOT EXISTS away_win_pct      integer;
