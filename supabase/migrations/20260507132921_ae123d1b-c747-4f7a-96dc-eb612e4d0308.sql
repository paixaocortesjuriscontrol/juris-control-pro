UPDATE public.publicacoes_djen
SET data_disponibilizacao = COALESCE(data_publicacao, created_at)
WHERE tipo_publicacao = 'pauta' AND data_disponibilizacao IS NULL;