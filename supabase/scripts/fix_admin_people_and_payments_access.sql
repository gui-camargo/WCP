-- ============================================================
-- WCP – Fix admin access on Admin > Pessoas
-- Objetivo:
-- 1) Admin visualizar todas as pessoas do bolao
-- 2) Admin confirmar/editar pagamentos
-- 3) Admin atualizar perfis quando necessario (ex.: is_admin)
-- ============================================================

BEGIN;

-- -------------------- Grants --------------------
GRANT USAGE ON SCHEMA public TO authenticated;

-- Profiles
GRANT SELECT ON public.profiles TO authenticated;
GRANT UPDATE ON public.profiles TO authenticated;

-- Pool members
GRANT SELECT ON public.pool_members TO authenticated;

-- Payments
GRANT SELECT, INSERT, UPDATE ON public.payments TO authenticated;

-- -------------------- Helper --------------------
CREATE OR REPLACE FUNCTION public.is_current_user_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT p.is_admin FROM public.profiles p WHERE p.id = auth.uid()), false);
$$;

GRANT EXECUTE ON FUNCTION public.is_current_user_admin() TO authenticated;

-- -------------------- RLS policies: pool_members --------------------
DROP POLICY IF EXISTS "pool_members_select" ON public.pool_members;
CREATE POLICY "pool_members_select" ON public.pool_members
FOR SELECT
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM public.pools p
    WHERE p.id = pool_members.pool_id
      AND p.owner_id = auth.uid()
  )
  OR public.is_current_user_admin()
);

-- -------------------- RLS policies: profiles --------------------
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
CREATE POLICY "profiles_select" ON public.profiles
FOR SELECT
USING (
  auth.uid() = id
  OR public.is_current_user_admin()
  OR EXISTS (
    SELECT 1
    FROM public.pool_members pm_viewer
    JOIN public.pool_members pm_target ON pm_target.pool_id = pm_viewer.pool_id
    WHERE pm_viewer.user_id = auth.uid()
      AND pm_target.user_id = profiles.id
  )
);

-- Mantem policy do proprio usuario e adiciona policy explicita de admin para UPDATE.
DROP POLICY IF EXISTS "profiles_admin_update" ON public.profiles;
CREATE POLICY "profiles_admin_update" ON public.profiles
FOR UPDATE
USING (public.is_current_user_admin())
WITH CHECK (public.is_current_user_admin());

-- -------------------- RLS policies: payments --------------------
-- Garante helper usado na policy de payments.
CREATE OR REPLACE FUNCTION public.is_pool_owner_or_admin(p_pool_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.pools p
    WHERE p.id = p_pool_id
      AND p.owner_id = auth.uid()
  )
  OR public.is_current_user_admin();
$$;

GRANT EXECUTE ON FUNCTION public.is_pool_owner_or_admin(UUID) TO authenticated;

DROP POLICY IF EXISTS "payments_select" ON public.payments;
CREATE POLICY "payments_select" ON public.payments
FOR SELECT
USING (
  auth.uid() = user_id
  OR public.is_pool_owner_or_admin(pool_id)
);

DROP POLICY IF EXISTS "payments_insert" ON public.payments;
CREATE POLICY "payments_insert" ON public.payments
FOR INSERT
WITH CHECK (
  public.is_pool_owner_or_admin(pool_id)
);

DROP POLICY IF EXISTS "payments_update" ON public.payments;
CREATE POLICY "payments_update" ON public.payments
FOR UPDATE
USING (
  public.is_pool_owner_or_admin(pool_id)
)
WITH CHECK (
  public.is_pool_owner_or_admin(pool_id)
);

COMMIT;

-- -------------------- Verificacao rapida --------------------
-- Rode estes testes logado como admin secundario:
-- SELECT auth.uid(), public.is_current_user_admin();
-- SELECT COUNT(*) FROM public.pool_members WHERE pool_id = 'SEU_POOL_ID';
-- SELECT COUNT(*) FROM public.profiles;
-- SELECT COUNT(*) FROM public.payments WHERE pool_id = 'SEU_POOL_ID';
