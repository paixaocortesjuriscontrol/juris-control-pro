
UPDATE public.publicacoes_djen_processos pdp
SET coordenacao_id = p.coordenacao_id
FROM public.processos p
WHERE p.id = pdp.processo_id AND pdp.coordenacao_id IS NULL;
