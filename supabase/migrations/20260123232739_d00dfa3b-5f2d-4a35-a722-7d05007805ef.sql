
UPDATE processos
SET monitorar_andamentos = true
WHERE coordenacao_id = '968631d0-6659-46f1-b45d-899892cb0121'
  AND (monitorar_andamentos IS NULL OR monitorar_andamentos = false);
