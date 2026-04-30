-- Permitir múltiplos registros sem dossiê (dossie NULL) mantendo unicidade quando dossie está preenchido
DROP INDEX IF EXISTS public.dados_benner_processo_dossie_uniq;

CREATE UNIQUE INDEX dados_benner_processo_dossie_uniq
  ON public.dados_benner USING btree (processo, dossie);
-- Por padrão NULLS DISTINCT: linhas com dossie NULL não conflitam entre si.