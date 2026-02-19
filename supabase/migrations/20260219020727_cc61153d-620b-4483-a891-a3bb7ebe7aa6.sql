
UPDATE tarefas
SET 
  status = 'cumprido',
  data_cumprimento = CURRENT_DATE
WHERE status != 'cumprido'
  AND data_vencimento < CURRENT_DATE;
