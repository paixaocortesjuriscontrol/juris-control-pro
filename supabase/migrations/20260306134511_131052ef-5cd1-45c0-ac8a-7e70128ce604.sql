
-- Apagar publicações de termos (publicacoes_djen) de hoje da coordenação Dra. Vanessa
DELETE FROM public.publicacoes_djen
WHERE monitoramento_id IN (
  SELECT id FROM public.monitoramentos_djen 
  WHERE coordenacao_id = 'b6a3a750-3109-4962-bea9-7b5116e3a4fd'
)
AND created_at >= '2026-03-06T00:00:00Z'
AND created_at < '2026-03-07T00:00:00Z';

-- Apagar publicações descartadas de hoje da mesma coordenação
DELETE FROM public.publicacoes_djen_descartadas
WHERE monitoramento_id IN (
  SELECT id FROM public.monitoramentos_djen 
  WHERE coordenacao_id = 'b6a3a750-3109-4962-bea9-7b5116e3a4fd'
)
AND created_at >= '2026-03-06T00:00:00Z'
AND created_at < '2026-03-07T00:00:00Z';

-- Apagar publicações por processo de hoje da mesma coordenação
DELETE FROM public.publicacoes_djen_processos
WHERE processo_id IN (
  SELECT id FROM public.processos 
  WHERE coordenacao_id = 'b6a3a750-3109-4962-bea9-7b5116e3a4fd'
)
AND created_at >= '2026-03-06T00:00:00Z'
AND created_at < '2026-03-07T00:00:00Z';
