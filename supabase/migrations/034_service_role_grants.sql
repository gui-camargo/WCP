-- ============================================================
-- WCP – Migration 034
-- Grant read/write access to service_role for Edge Functions
-- that sync live scores and map external match IDs
-- ============================================================

GRANT SELECT        ON public.teams   TO service_role;
GRANT SELECT        ON public.groups  TO service_role;
GRANT SELECT, UPDATE ON public.matches TO service_role;
