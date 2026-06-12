-- ============================================================
-- 031 - Permite admin atualizar nome de qualquer perfil
--
-- Regras de update em profiles:
-- 1) usuario comum pode atualizar apenas o proprio perfil
-- 2) admin pode atualizar qualquer perfil
-- 3) campos sensiveis (email, is_admin) devem permanecer inalterados
-- ============================================================

DROP POLICY IF EXISTS "profiles_update" ON public.profiles;

CREATE POLICY "profiles_update" ON public.profiles
FOR UPDATE
USING (
  auth.uid() = id
  OR public.is_current_user_admin()
)
WITH CHECK (
  (
    auth.uid() = id
    AND public.is_profile_sensitive_fields_unchanged(id, email, is_admin)
  )
  OR (
    public.is_current_user_admin()
    AND public.is_profile_sensitive_fields_unchanged(id, email, is_admin)
  )
);
