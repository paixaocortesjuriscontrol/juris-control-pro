
DELETE FROM public.comentarios_publicacoes_djen WHERE publicacao_id IN (SELECT id FROM public.publicacoes_djen WHERE created_at::date = CURRENT_DATE);
DELETE FROM public.publicacoes_djen_leituras WHERE publicacao_id IN (SELECT id FROM public.publicacoes_djen WHERE created_at::date = CURRENT_DATE);
DELETE FROM public.publicacoes_djen_global_hash WHERE publicacao_id IN (SELECT id FROM public.publicacoes_djen WHERE created_at::date = CURRENT_DATE) OR created_at::date = CURRENT_DATE;
DELETE FROM public.publicacoes_djen_descartadas WHERE created_at::date = CURRENT_DATE;
DELETE FROM public.publicacoes_djen WHERE created_at::date = CURRENT_DATE;
