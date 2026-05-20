-- ============================================================
-- WCP – Migration 013
-- Add active_pool_id to profiles for direct bolao navigation
-- ============================================================

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS active_pool_id UUID REFERENCES public.pools(id) ON DELETE SET NULL;
