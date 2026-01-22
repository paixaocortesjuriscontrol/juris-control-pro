-- Cancelar TUDO que está executando
UPDATE public.execucoes_agendadas
SET status = 'cancelado', finalizado_em = now()
WHERE status = 'executando';

-- Resetar metadata para não continuar
UPDATE public.configuracoes_monitoramento
SET metadata = jsonb_set(
  COALESCE(metadata, '{}'::jsonb),
  '{cancelado}',
  'true'::jsonb
)
WHERE tipo = 'djen';