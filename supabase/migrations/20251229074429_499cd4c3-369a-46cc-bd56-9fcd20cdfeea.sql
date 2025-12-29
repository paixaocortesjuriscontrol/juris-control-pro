-- Deletar processos da coordenação do Dr. Jhonatan
-- Primeiro, deletar registros relacionados que dependem de processos
DELETE FROM public.movimentacoes 
WHERE processo_id IN (
  SELECT id FROM public.processos WHERE coordenacao_id = '968631d0-6659-46f1-b45d-899892cb0121'
);

DELETE FROM public.prazos 
WHERE processo_id IN (
  SELECT id FROM public.processos WHERE coordenacao_id = '968631d0-6659-46f1-b45d-899892cb0121'
);

DELETE FROM public.documentos 
WHERE processo_id IN (
  SELECT id FROM public.processos WHERE coordenacao_id = '968631d0-6659-46f1-b45d-899892cb0121'
);

DELETE FROM public.alertas_monitoramento 
WHERE processo_id IN (
  SELECT id FROM public.processos WHERE coordenacao_id = '968631d0-6659-46f1-b45d-899892cb0121'
);

-- Agora deletar os processos
DELETE FROM public.processos 
WHERE coordenacao_id = '968631d0-6659-46f1-b45d-899892cb0121';