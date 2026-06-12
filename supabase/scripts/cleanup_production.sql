-- ============================================================
-- WCP – Production Cleanup Script (launch-ready)
-- Mantem apenas:
--   - galetao@gmail.com (admin)
--   - limpumper@gmail.com
-- Limpa todos os dados de teste (palpites, resultados, pagamentos etc.)
-- e deixa um bolao padrao global funcional.
--
-- Execute no Supabase SQL Editor.
-- ============================================================

BEGIN;

-- ==================== STEP 1: KEEP ONLY 2 AUTH USERS ====================
-- Importante: usa lower(email) para evitar problemas de caixa alta/baixa.
DELETE FROM auth.users
WHERE lower(email) NOT IN ('galetao@gmail.com', 'limpumper@gmail.com');

-- ==================== STEP 2: GUARANTEE PROFILES FOR KEPT USERS ====================
INSERT INTO public.profiles (id, name, email, is_admin)
SELECT
  u.id,
  COALESCE(u.raw_user_meta_data->>'name', split_part(u.email, '@', 1)) AS name,
  u.email,
  CASE WHEN lower(u.email) = 'galetao@gmail.com' THEN true ELSE false END AS is_admin
FROM auth.users u
WHERE lower(u.email) IN ('galetao@gmail.com', 'limpumper@gmail.com')
ON CONFLICT (id) DO UPDATE
SET
  email = EXCLUDED.email,
  name = EXCLUDED.name,
  is_admin = CASE
    WHEN lower(EXCLUDED.email) = 'galetao@gmail.com' THEN true
    ELSE public.profiles.is_admin
  END;

-- Forca o admin principal.
UPDATE public.profiles
SET is_admin = true
WHERE lower(email) = 'galetao@gmail.com';

-- ==================== STEP 3: REMOVE ALL TEST DATA ====================
-- Limpa dados transacionais.
DELETE FROM public.group_predictions;
DELETE FROM public.predictions;
DELETE FROM public.payments;
DELETE FROM public.pool_members;
DELETE FROM public.group_standings;

-- Zera resultados dos jogos (mantem grade de jogos).
UPDATE public.matches
SET
  home_score = NULL,
  away_score = NULL,
  status = 'pendente';

-- ==================== STEP 4: KEEP MATCH STRUCTURE + ENSURE DEFAULT POOL ====================
-- Nao apagar pools para nao remover rounds/matches por cascade.
WITH admin_owner AS (
  SELECT p.id
  FROM public.profiles p
  WHERE lower(p.email) = 'galetao@gmail.com'
  LIMIT 1
), chosen_pool AS (
  -- Prioriza pool que ja tenha rodadas/jogos para manter a grade existente.
  SELECT p.id
  FROM public.pools p
  ORDER BY (
    SELECT COUNT(*)
    FROM public.rounds r
    WHERE r.pool_id = p.id
  ) DESC, p.created_at ASC
  LIMIT 1
), created_pool AS (
  -- Se nao existir pool algum, cria um novo.
  INSERT INTO public.pools (name, owner_id, is_default_global)
  SELECT 'Bolao Oficial Copa 2026', ao.id, true
  FROM admin_owner ao
  WHERE NOT EXISTS (SELECT 1 FROM chosen_pool)
  RETURNING id
), pool_to_use AS (
  SELECT id FROM chosen_pool
  UNION ALL
  SELECT id FROM created_pool
  LIMIT 1
)
UPDATE public.pools p
SET
  is_default_global = (p.id = (SELECT id FROM pool_to_use)),
  owner_id = CASE
    WHEN p.id = (SELECT id FROM pool_to_use) THEN (SELECT id FROM admin_owner)
    ELSE p.owner_id
  END;

WITH pool_to_use AS (
  SELECT p.id
  FROM public.pools p
  WHERE p.is_default_global = true
  LIMIT 1
)
INSERT INTO public.pool_members (pool_id, user_id)
SELECT pu.id, p.id
FROM pool_to_use pu
CROSS JOIN public.profiles p
WHERE lower(p.email) IN ('galetao@gmail.com', 'limpumper@gmail.com')
ON CONFLICT (pool_id, user_id) DO NOTHING;

-- Gera pagamentos pendentes para os membros (trigger ja cobre, mas garantimos).
INSERT INTO public.payments (pool_id, user_id, amount_cents, status)
SELECT pm.pool_id, pm.user_id, 10000, 'pendente'
FROM public.pool_members pm
ON CONFLICT (pool_id, user_id) DO NOTHING;

-- Define active_pool_id para os dois usuarios.
UPDATE public.profiles p
SET active_pool_id = pm.pool_id
FROM public.pool_members pm
WHERE pm.user_id = p.id
  AND lower(p.email) IN ('galetao@gmail.com', 'limpumper@gmail.com');

COMMIT;

-- ==================== STEP 5: FINAL VERIFICATION ====================
SELECT '=== REMAINING AUTH USERS ===' AS status;
SELECT id, email, created_at
FROM auth.users
ORDER BY created_at;

SELECT '=== REMAINING PROFILES ===' AS status;
SELECT id, name, email, is_admin, active_pool_id
FROM public.profiles
ORDER BY created_at;

SELECT '=== POOLS ===' AS status;
SELECT id, name, owner_id, is_default_global, created_at
FROM public.pools
ORDER BY created_at;

SELECT '=== MEMBERS ===' AS status;
SELECT pool_id, user_id, joined_at
FROM public.pool_members
ORDER BY joined_at;

SELECT '=== MATCH RESULTS FILLED (must be 0) ===' AS status;
SELECT COUNT(*) AS finished_matches
FROM public.matches
WHERE status = 'encerrado'
   OR home_score IS NOT NULL
   OR away_score IS NOT NULL;

SELECT '=== DATA CLEANUP COMPLETE ===' AS status;
