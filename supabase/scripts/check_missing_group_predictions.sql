-- ============================================================
-- Script para verificar usuários que ainda não deram palpites
-- de classificados de grupo - em todos os bolões
-- ============================================================

SELECT 
  p.name as usuario,
  COUNT(DISTINCT g.id) as grupos_totais,
  COUNT(DISTINCT gp.id) as grupos_com_palpite,
  COUNT(DISTINCT g.id) - COUNT(DISTINCT gp.id) as grupos_sem_palpite
FROM pool_members pm
JOIN profiles p ON p.id = pm.user_id
CROSS JOIN groups g
LEFT JOIN group_predictions gp 
  ON gp.pool_id = pm.pool_id 
  AND gp.user_id = pm.user_id 
  AND gp.group_id = g.id
GROUP BY p.id, p.name
ORDER BY grupos_sem_palpite DESC, p.name;
