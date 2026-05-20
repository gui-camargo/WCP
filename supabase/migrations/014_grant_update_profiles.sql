-- ============================================================
-- WCP – Migration 014
-- Grant UPDATE on profiles to authenticated users
-- ============================================================

GRANT UPDATE ON public.profiles TO authenticated;
