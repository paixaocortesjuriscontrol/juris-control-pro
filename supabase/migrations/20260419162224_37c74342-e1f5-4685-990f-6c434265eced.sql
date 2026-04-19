UPDATE public.dados_benner
SET data_distribuicao_planilha = data_distribuicao_real
WHERE data_distribuicao_planilha IS NULL
  AND data_distribuicao_real IS NOT NULL;