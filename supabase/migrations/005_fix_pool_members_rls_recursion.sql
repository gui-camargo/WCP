-- ============================================================
-- WCP – Bolao Copa do Mundo
-- Migration 005 – Fix RLS recursion on pool_members
-- Execute esta migration em bancos que ja aplicaram a 001
-- ============================================================

DROP POLICY IF EXISTS "pool_members_select" ON pool_members;

-- Evita recursao infinita: policy nao pode consultar a propria tabela.
CREATE POLICY "pool_members_select" ON pool_members FOR SELECT USING (
  user_id = auth.uid()
);
