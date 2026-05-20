-- ============================================================
-- WCP – Migration 017
-- Add venue to matches for UI display
-- ============================================================

ALTER TABLE public.matches
ADD COLUMN IF NOT EXISTS venue TEXT;

UPDATE public.matches
SET venue = ''
WHERE venue IS NULL;

ALTER TABLE public.matches
ALTER COLUMN venue SET DEFAULT '';

ALTER TABLE public.matches
ALTER COLUMN venue SET NOT NULL;
