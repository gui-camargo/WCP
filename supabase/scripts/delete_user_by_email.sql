-- ============================================================
-- WCP - Remover usuario por e-mail (bolao + banco)
--
-- Objetivo:
-- - Remover o usuario de todo o sistema a partir do e-mail.
-- - Ao apagar em auth.users, o perfil e dados relacionados em public
--   sao removidos por cascata (FK ON DELETE CASCADE).
--
-- Seguranca:
-- - Script bloqueia exclusao se o usuario for dono de algum bolao.
--   (evita apagar um bolao inteiro por cascata sem querer)
--
-- Uso no Supabase SQL Editor:
-- 1) Edite email_alvo no bloco PARAMS.
-- 2) Execute PREVIEW e confira os dados.
-- 3) Execute o bloco DELETE para remover de fato.
-- ============================================================

-- ============================================================
-- PARAMS (edite aqui)
-- ============================================================
-- Exemplo:
--   email_alvo = 'teste@teste.com'


-- ============================================================
-- PREVIEW (confere quem sera removido)
-- ============================================================
WITH params AS (
  SELECT 'eudiogovidal@gmail.com'::text AS email_alvo
),
alvo AS (
  SELECT u.id, u.email
  FROM auth.users u
  CROSS JOIN params
  WHERE lower(u.email) = lower(params.email_alvo)
)
SELECT
  a.id AS user_id,
  a.email,
  p.name,
  p.is_admin,
  (SELECT count(*) FROM public.pool_members pm WHERE pm.user_id = a.id) AS memberships_count,
  (SELECT count(*) FROM public.pools po WHERE po.owner_id = a.id) AS owned_pools_count,
  (SELECT count(*) FROM public.predictions pr WHERE pr.user_id = a.id) AS predictions_count,
  (SELECT count(*) FROM public.group_predictions gp WHERE gp.user_id = a.id) AS group_predictions_count,
  (SELECT count(*) FROM public.podium_predictions pp WHERE pp.user_id = a.id) AS podium_predictions_count,
  (SELECT count(*) FROM public.payments pay WHERE pay.user_id = a.id) AS payments_count
FROM alvo a
LEFT JOIN public.profiles p ON p.id = a.id;

-- Pools dos quais o usuario e dono (se houver)
WITH params AS (
  SELECT 'teste@teste.com'::text AS email_alvo
),
alvo AS (
  SELECT u.id, u.email
  FROM auth.users u
  CROSS JOIN params
  WHERE lower(u.email) = lower(params.email_alvo)
)
SELECT po.id, po.name, po.owner_id
FROM public.pools po
JOIN alvo a ON a.id = po.owner_id;


-- ============================================================
-- DELETE (remove usuario por completo via auth.users)
--
-- Importante:
-- - Se o usuario for owner de algum bolao, o script aborta com erro.
--   Nesse caso, troque o owner primeiro e rode novamente.
-- ============================================================
BEGIN;

DO $delete_user$
DECLARE
  v_email text := 'teste@teste.com';
  v_user_id uuid;
  v_owned_pools integer;
  v_deleted integer;
BEGIN
  SELECT u.id
  INTO v_user_id
  FROM auth.users u
  WHERE lower(u.email) = lower(v_email)
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Nenhum usuario encontrado para o e-mail: %', v_email;
  END IF;

  SELECT count(*)
  INTO v_owned_pools
  FROM public.pools po
  WHERE po.owner_id = v_user_id;

  IF v_owned_pools > 0 THEN
    RAISE EXCEPTION 'Usuario (%) e dono de % bolao(oes). Transfira ownership antes de excluir.', v_email, v_owned_pools;
  END IF;

  DELETE FROM auth.users u
  WHERE u.id = v_user_id;

  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  IF v_deleted <> 1 THEN
    RAISE EXCEPTION 'Falha ao excluir usuario (%) em auth.users.', v_email;
  END IF;

  RAISE NOTICE 'Usuario removido com sucesso: % (%).', v_email, v_user_id;
END;
$delete_user$;

COMMIT;


-- ============================================================
-- VERIFICACAO RAPIDA (opcional)
-- ============================================================
-- WITH params AS (
--   SELECT 'teste@teste.com'::text AS email_alvo
-- )
-- SELECT id, email
-- FROM auth.users u
-- CROSS JOIN params
-- WHERE lower(u.email) = lower(params.email_alvo);
