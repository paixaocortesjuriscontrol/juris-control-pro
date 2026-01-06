-- Habilitar monitoramento de andamentos para todos os processos da Coordenação Dr. Jhonatan
UPDATE public.processos 
SET monitorar_andamentos = true 
WHERE coordenacao_id = '968631d0-6659-46f1-b45d-899892cb0121' 
  AND monitorar_andamentos = false;