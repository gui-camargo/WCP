-- ============================================================
-- WCP – Migration 024
-- Corrige grants de UPDATE para payments (upsert) e profiles (admin)
-- ============================================================

-- O PostgREST/Supabase upsert com on_conflict pode executar UPDATE
-- usando tambem colunas presentes no payload (incluindo pool_id/user_id).
-- Sem UPDATE no nivel da tabela, o role authenticated pode receber 42501.

GRANT SELECT, INSERT, UPDATE ON TABLE public.payments TO authenticated;

-- A tela de admin atualiza profiles.is_admin via PATCH em /profiles.
-- Sem UPDATE no nivel da tabela, o role authenticated recebe 42501.
GRANT UPDATE ON TABLE public.profiles TO authenticated;
