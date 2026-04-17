-- Índice único parcial para suportar upsert em batch usando (processo, dossie) como chave funcional
-- Inclui apenas registros de importação de planilha (aba_origem IS NOT NULL) para não conflitar com inserts manuais
CREATE UNIQUE INDEX IF NOT EXISTS dados_benner_processo_dossie_uniq
ON public.dados_benner (processo, dossie)
WHERE processo IS NOT NULL AND dossie IS NOT NULL;