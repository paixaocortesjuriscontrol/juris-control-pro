-- Limpar logs de execução DJEN de hoje para permitir nova execução

-- Runs DJEN de hoje
DELETE FROM public.djen_runs
WHERE created_at >= (now() AT TIME ZONE 'America/Sao_Paulo')::date
  AND created_at < ((now() AT TIME ZONE 'America/Sao_Paulo')::date + interval '1 day');

-- Lotes DJEN de hoje
DELETE FROM public.djen_lotes
WHERE created_at >= (now() AT TIME ZONE 'America/Sao_Paulo')::date
  AND created_at < ((now() AT TIME ZONE 'America/Sao_Paulo')::date + interval '1 day');

-- Estatísticas por tribunal de hoje
DELETE FROM public.djen_tribunais_lote
WHERE created_at >= (now() AT TIME ZONE 'America/Sao_Paulo')::date
  AND created_at < ((now() AT TIME ZONE 'America/Sao_Paulo')::date + interval '1 day');

-- Histórico de monitoramento DJEN de hoje
DELETE FROM public.historico_monitoramento
WHERE tipo IN ('djen', 'djen_processos')
  AND executado_em >= (now() AT TIME ZONE 'America/Sao_Paulo')::date
  AND executado_em < ((now() AT TIME ZONE 'America/Sao_Paulo')::date + interval '1 day');

-- Resetar metadata de continuação nas configurações
UPDATE public.configuracoes_monitoramento
SET metadata = jsonb_set(
  COALESCE(metadata, '{}'::jsonb),
  '{offset}',
  '0'
)
WHERE tipo IN ('djen', 'djen_processos');