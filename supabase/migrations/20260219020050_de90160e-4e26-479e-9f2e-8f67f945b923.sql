
UPDATE tarefas t
SET 
  status = 'cumprido',
  data_cumprimento = CURRENT_DATE
FROM processos p
WHERE p.id = t.processo_id
  AND p.coordenacao_id = 'f73e8ee7-924c-4518-bbdc-62dd77df93a1'
  AND t.status != 'cumprido';
