-- ============================================================
-- WCP – Migration 038
-- Add time_detail column to matches for live match clock display
-- ============================================================

ALTER TABLE matches ADD COLUMN IF NOT EXISTS time_detail text;
