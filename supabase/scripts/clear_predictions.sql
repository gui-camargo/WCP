-- ============================================================
-- WCP – Utilitario de limpeza de palpites
--
-- Uso no Supabase SQL Editor:
-- 1) Escolha UMA das secoes abaixo.
-- 2) Execute dentro de transacao para poder rollbackar se necessario.
-- ============================================================

-- ============================================================
-- OPCAO A: limpar TODOS os palpites de TODOS os boloes
-- ============================================================
BEGIN;

DELETE FROM public.group_predictions;
DELETE FROM public.podium_predictions;
DELETE FROM public.predictions;

COMMIT;


-- ============================================================
-- OPCAO B: limpar palpites de UM bolao especifico
-- Substitua o UUID abaixo pelo pool_id desejado.
-- ============================================================
-- BEGIN;
--
-- DELETE FROM public.group_predictions
-- WHERE pool_id = '00000000-0000-0000-0000-000000000000';
--
-- DELETE FROM public.podium_predictions
-- WHERE pool_id = '00000000-0000-0000-0000-000000000000';
--
-- DELETE FROM public.predictions
-- WHERE pool_id = '00000000-0000-0000-0000-000000000000';
--
-- COMMIT;


-- ============================================================
-- OPCAO C: limpar TODOS os jogos encerrados (apaga registros)
-- ============================================================
-- BEGIN;
--
-- DELETE FROM public.matches
-- WHERE status = 'encerrado';
--
-- COMMIT;


-- ============================================================
-- OPCAO D: limpar jogos encerrados de UM bolao especifico (apaga registros)
-- Substitua o UUID abaixo pelo pool_id desejado.
-- ============================================================
BEGIN;

DELETE FROM public.matches m
USING public.rounds r
WHERE m.round_id = r.id
  AND r.pool_id = '00000000-0000-0000-0000-000000000000'
  AND m.status = 'encerrado';

COMMIT;


-- ============================================================
-- OPCAO E: reabrir jogos encerrados (nao apaga; zera placar e status)
-- ============================================================
BEGIN;

UPDATE public.matches
SET home_score = NULL,
    away_score = NULL,
    status = 'pendente'
WHERE status = 'encerrado';

COMMIT;


-- ============================================================
-- OPCAO F: reabrir jogos encerrados de UM bolao (nao apaga)
-- Substitua o UUID abaixo pelo pool_id desejado.
-- ============================================================
-- BEGIN;
--
-- UPDATE public.matches m
-- SET home_score = NULL,
--     away_score = NULL,
--     status = 'pendente'
-- FROM public.rounds r
-- WHERE m.round_id = r.id
--   AND r.pool_id = '00000000-0000-0000-0000-000000000000'
--   AND m.status = 'encerrado';
--
-- COMMIT;


-- ============================================================
-- VERIFICACAO RAPIDA (opcional)
-- ============================================================
-- SELECT COUNT(*) AS predictions_count FROM public.predictions;
-- SELECT COUNT(*) AS group_predictions_count FROM public.group_predictions;
-- SELECT COUNT(*) AS podium_predictions_count FROM public.podium_predictions;
-- SELECT COUNT(*) AS closed_matches_count FROM public.matches WHERE status = 'encerrado';
