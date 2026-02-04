
-- Desabilitar monitoramento DJEN para processos das coordenações Santander
-- Santander Cível: 968631d0-6659-46f1-b45d-899892cb0121 (10.736 processos)
-- Santander Trabalhista: 70d3e1ba-70ff-46d0-a6cf-4d4b553d324a (998 processos, já desabilitados)

UPDATE processos 
SET 
  monitorar_djen = false, 
  updated_at = now()
WHERE coordenacao_id = '968631d0-6659-46f1-b45d-899892cb0121'
  AND monitorar_djen = true;
