-- Substituir índice único parcial por índice único total para suportar ON CONFLICT no upsert
DROP INDEX IF EXISTS public.dados_benner_processo_dossie_uniq;

-- Antes de criar o índice único total, garantir que não existem duplicatas
-- Mantém o registro mais recente de cada par (processo, dossie)
DELETE FROM public.dados_benner a
USING public.dados_benner b
WHERE a.ctid < b.ctid
  AND a.processo IS NOT DISTINCT FROM b.processo
  AND a.dossie IS NOT DISTINCT FROM b.dossie;

-- Índice único total (sem WHERE) — necessário para uso como alvo do ON CONFLICT
-- NULLS NOT DISTINCT trata NULLs como iguais, evitando múltiplos registros sem dossie
CREATE UNIQUE INDEX dados_benner_processo_dossie_uniq
ON public.dados_benner (processo, dossie) NULLS NOT DISTINCT;