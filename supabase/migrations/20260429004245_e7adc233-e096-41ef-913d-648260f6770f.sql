UPDATE public.publicacoes_djen_processos 
SET dedup_key = public.compute_djen_dedup_key(coordenacao_id, processo_numero, data_disponibilizacao, data_publicacao, created_at) 
WHERE dedup_key IS NULL;