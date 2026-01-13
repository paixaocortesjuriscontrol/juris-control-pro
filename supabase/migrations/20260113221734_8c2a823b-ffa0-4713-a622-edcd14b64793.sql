-- Atualizar data_disponibilizacao para todas as publicações que estão NULL
-- A data de disponibilização é tipicamente 1 dia antes da publicação
UPDATE public.publicacoes_djen
SET data_disponibilizacao = (data_publicacao::date - interval '1 day')::timestamptz
WHERE data_disponibilizacao IS NULL AND data_publicacao IS NOT NULL;

UPDATE public.publicacoes_djen_processos
SET data_disponibilizacao = (data_publicacao::date - interval '1 day')::timestamptz
WHERE data_disponibilizacao IS NULL AND data_publicacao IS NOT NULL;