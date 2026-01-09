
-- Desativar monitoramento de andamentos para todos os processos da Coordenação Dr. Jhonatan
UPDATE processos 
SET monitorar_andamentos = false, updated_at = now()
WHERE coordenacao_id = '968631d0-6659-46f1-b45d-899892cb0121'
  AND monitorar_andamentos = true;
