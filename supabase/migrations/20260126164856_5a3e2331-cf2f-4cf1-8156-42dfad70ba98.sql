-- Atualizar publicações de hoje que estão com datas NULL
-- Usar a data de criação como base para calcular as datas

-- Primeiro: atualizar data_disponibilizacao baseado na data de criação (um dia antes)
UPDATE public.publicacoes_djen
SET 
  data_disponibilizacao = (created_at AT TIME ZONE 'America/Sao_Paulo')::date - interval '1 day',
  data_publicacao = (created_at AT TIME ZONE 'America/Sao_Paulo')::date
WHERE data_disponibilizacao IS NULL 
  AND data_publicacao IS NULL
  AND created_at >= '2026-01-26';

-- Também atualizar publicacoes_djen_processos se tiver registros afetados
UPDATE public.publicacoes_djen_processos
SET 
  data_disponibilizacao = (created_at AT TIME ZONE 'America/Sao_Paulo')::date - interval '1 day',
  data_publicacao = (created_at AT TIME ZONE 'America/Sao_Paulo')::date
WHERE data_disponibilizacao IS NULL 
  AND data_publicacao IS NULL
  AND created_at >= '2026-01-26';