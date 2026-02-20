-- Reclassificar tarefas que contenham a palavra "intimação" (com ou sem acentos)
-- no título ou na descrição, que ainda não estejam classificadas como INTIMAÇÃO

UPDATE tarefas
SET tipo_tarefa = 'INTIMAÇÃO'
WHERE tipo_tarefa IS DISTINCT FROM 'INTIMAÇÃO'
  AND (
    titulo       ILIKE '%intima%'
    OR descricao ILIKE '%intima%'
  );