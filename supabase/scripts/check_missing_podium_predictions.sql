-- ============================================================
-- Script para verificar usuários que ainda não deram palpites
-- de campeão, vice e terceiro colocados - em todos os bolões
-- ============================================================

SELECT 
  p.name as usuario,
  COUNT(DISTINCT pm.pool_id) as pools_totais,
  COUNT(DISTINCT pp.id) as pools_com_palpite,
  COUNT(DISTINCT pm.pool_id) - COUNT(DISTINCT pp.id) as pools_sem_palpite
FROM pool_members pm
JOIN profiles p ON p.id = pm.user_id
LEFT JOIN podium_predictions pp 
  ON pp.pool_id = pm.pool_id 
  AND pp.user_id = pm.user_id
GROUP BY p.id, p.name
ORDER BY pools_sem_palpite DESC, p.name;
