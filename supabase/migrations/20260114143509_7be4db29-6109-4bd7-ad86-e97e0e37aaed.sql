-- Preencher datas faltantes em publicacoes_djen_processos
-- Para registros que têm data_publicacao mas não têm data_disponibilizacao
UPDATE public.publicacoes_djen_processos
SET data_disponibilizacao = (data_publicacao::date - interval '1 day')::timestamptz
WHERE data_disponibilizacao IS NULL AND data_publicacao IS NOT NULL;

-- Para registros que têm data_disponibilizacao mas não têm data_publicacao
UPDATE public.publicacoes_djen_processos
SET data_publicacao = (data_disponibilizacao::date + interval '1 day')::timestamptz
WHERE data_publicacao IS NULL AND data_disponibilizacao IS NOT NULL;