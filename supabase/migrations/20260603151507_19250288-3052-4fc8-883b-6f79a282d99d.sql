UPDATE public.monitoramentos_djen
SET descricao = 'JOÃO - ' || termo_busca
WHERE ativo = true
  AND (descricao IS NULL OR descricao = '')
  AND coordenacao_id IN (SELECT id FROM public.coordenacoes WHERE nome ILIKE '%renata%santander%');