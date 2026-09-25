CREATE INDEX IF NOT EXISTS idx_processos_numero_digits_trgm
ON public.processos USING gin ((regexp_replace(coalesce(numero, ''), '\D', '', 'g')) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_processos_dossie_tst_digits_trgm
ON public.processos USING gin ((regexp_replace(coalesce(dossie_tst, ''), '\D', '', 'g')) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_processos_pasta_cliente_digits_trgm
ON public.processos USING gin ((regexp_replace(coalesce(pasta_cliente, ''), '\D', '', 'g')) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_processos_pasta_fisica_digits_trgm
ON public.processos USING gin ((regexp_replace(coalesce(pasta_fisica, ''), '\D', '', 'g')) gin_trgm_ops);