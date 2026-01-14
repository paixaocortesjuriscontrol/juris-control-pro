-- Limpar publicações DJEN de hoje (timezone BRT)
-- Isso permite reexecutar os monitoramentos do zero

-- Publicações principais
DELETE FROM public.publicacoes_djen
WHERE created_at >= (now() AT TIME ZONE 'America/Sao_Paulo')::date
  AND created_at < ((now() AT TIME ZONE 'America/Sao_Paulo')::date + interval '1 day');

-- Publicações descartadas
DELETE FROM public.publicacoes_djen_descartadas
WHERE created_at >= (now() AT TIME ZONE 'America/Sao_Paulo')::date
  AND created_at < ((now() AT TIME ZONE 'America/Sao_Paulo')::date + interval '1 day');

-- Cache de hash global (deduplicação)
DELETE FROM public.publicacoes_djen_global_hash
WHERE created_at >= (now() AT TIME ZONE 'America/Sao_Paulo')::date
  AND created_at < ((now() AT TIME ZONE 'America/Sao_Paulo')::date + interval '1 day');

-- Publicações por processo
DELETE FROM public.publicacoes_djen_processos
WHERE created_at >= (now() AT TIME ZONE 'America/Sao_Paulo')::date
  AND created_at < ((now() AT TIME ZONE 'America/Sao_Paulo')::date + interval '1 day');