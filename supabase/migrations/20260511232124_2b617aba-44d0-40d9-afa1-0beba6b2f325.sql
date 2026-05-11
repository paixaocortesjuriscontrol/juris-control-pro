UPDATE public.dados_benner
SET fontes_importacao = ARRAY['Planilha Distribuição']::text[]
WHERE aba_origem IS NOT NULL
  AND aba_origem NOT IN ('Certidão TST', 'Manual')
  AND (fontes_importacao IS NULL OR array_length(fontes_importacao, 1) IS NULL);