-- Script para zerar a classificação real do Grupo A

UPDATE group_standings
SET 
  first_id = NULL,
  second_id = NULL
WHERE group_id = (
  SELECT id FROM groups WHERE code = 'A'
);

-- Verificar resultado
SELECT 
  g.id,
  g.code,
  gs.first_id,
  gs.second_id
FROM group_standings gs
JOIN groups g ON g.id = gs.group_id
WHERE g.code = 'A';
