-- ============================================================
-- WCP – Migration 020
-- Global default pool + onboarding visibility
-- ============================================================

ALTER TABLE public.pools
ADD COLUMN IF NOT EXISTS is_default_global BOOLEAN NOT NULL DEFAULT false;

-- Garantir no maximo um bolao padrão global ativo.
CREATE UNIQUE INDEX IF NOT EXISTS uq_pools_default_global_true
ON public.pools (is_default_global)
WHERE is_default_global = true;

-- Todos usuarios autenticados podem ver o bolao padrao global.
DROP POLICY IF EXISTS "pools_select" ON public.pools;
CREATE POLICY "pools_select" ON public.pools FOR SELECT USING (
  owner_id = auth.uid()
  OR public.is_current_user_pool_member(public.pools.id)
  OR public.is_current_user_admin()
  OR is_default_global = true
);

-- Membros podem se auto-adicionar apenas no bolao padrao global.
DROP POLICY IF EXISTS "pool_members_insert" ON public.pool_members;
CREATE POLICY "pool_members_insert" ON public.pool_members FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.pools p
    WHERE p.id = pool_id
      AND p.owner_id = auth.uid()
  )
  OR public.is_current_user_admin()
  OR (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.pools p
      WHERE p.id = pool_id
        AND p.is_default_global = true
    )
  )
);

-- Define um bolao como padrao global (somente admin).
CREATE OR REPLACE FUNCTION public.set_global_default_pool(p_pool_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_current_user_admin() THEN
    RAISE EXCEPTION 'Apenas administradores podem definir o bolao padrao global.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.pools p WHERE p.id = p_pool_id) THEN
    RAISE EXCEPTION 'Bolao nao encontrado.';
  END IF;

  UPDATE public.pools
  SET is_default_global = false
  WHERE is_default_global = true
    AND id <> p_pool_id;

  UPDATE public.pools
  SET is_default_global = true
  WHERE id = p_pool_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_global_default_pool(UUID) TO authenticated;
