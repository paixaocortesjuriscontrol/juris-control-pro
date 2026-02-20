
UPDATE tarefas
SET tipo_tarefa = 'AUDIÊNCIA'
WHERE (
  titulo ILIKE '%audiência%' OR titulo ILIKE '%audiencia%' OR
  descricao ILIKE '%audiência%' OR descricao ILIKE '%audiencia%'
)
AND (tipo_tarefa != 'AUDIÊNCIA' OR tipo_tarefa IS NULL);
