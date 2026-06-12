-- ============================================================
-- Script: Fix Scotland Flag Code
-- Purpose: Update Scotland's flag code from GB to SC
-- Date: 2026-06-11
-- ============================================================

UPDATE public.teams
SET flag_code = 'GB-SCT'
WHERE name = 'Escócia' AND flag_code = 'GB';

-- Verify the update
SELECT id, name, flag_code FROM public.teams WHERE name = 'Escócia';
