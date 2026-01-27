-- Habilitar monitoramento DJEN para todos os processos ativos da coordenação Santander Cível
UPDATE public.processos
SET monitorar_djen = true
WHERE coordenacao_id = '968631d0-6659-46f1-b45d-899892cb0121'
  AND status = 'ativo'
  AND (monitorar_djen IS NULL OR monitorar_djen = false);