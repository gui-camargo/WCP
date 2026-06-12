-- ============================================================
-- WCP - Atualizar nome de membro por e-mail
--
-- Uso no Supabase SQL Editor:
-- 1) Troque os valores em PARAMS (email e novo_nome).
-- 2) Execute o bloco de PREVIEW para confirmar o alvo.
-- 3) Execute o bloco de UPDATE.
-- ============================================================

-- ============================================================
-- PARAMS (edite aqui)
-- ============================================================
-- Exemplo:
--   email_alvo = 'membro@exemplo.com'
--   novo_nome  = 'Nome Novo'

-- ============================================================
-- PREVIEW (confere quem sera alterado)
-- ============================================================
WITH params AS (
  SELECT
    'membro@exemplo.com'::text AS email_alvo,
    'Nome Novo'::text AS novo_nome
)
SELECT
  p.id,
  p.email,
  p.name AS nome_atual,
  params.novo_nome AS nome_novo
FROM public.profiles p
CROSS JOIN params
WHERE lower(p.email) = lower(params.email_alvo);


-- ============================================================
-- UPDATE (altera o nome do perfil pelo e-mail)
-- Observacao: o nome fica global para o usuario (todos os boloes).
-- ============================================================
BEGIN;

WITH params AS (
  SELECT
    'membro@exemplo.com'::text AS email_alvo,
    'Nome Novo'::text AS novo_nome
)
UPDATE public.profiles p
SET name = params.novo_nome
FROM params
WHERE lower(p.email) = lower(params.email_alvo);

COMMIT;


-- ============================================================
-- VERIFICACAO RAPIDA (opcional)
-- ============================================================
-- WITH params AS (
--   SELECT 'membro@exemplo.com'::text AS email_alvo
-- )
-- SELECT id, email, name
-- FROM public.profiles p
-- CROSS JOIN params
-- WHERE lower(p.email) = lower(params.email_alvo);
