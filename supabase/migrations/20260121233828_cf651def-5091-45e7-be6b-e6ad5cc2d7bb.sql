-- Forçar cancelamento das execuções zumbis
UPDATE execucoes_agendadas 
SET status = 'cancelado', 
    finalizado_em = now(), 
    detalhes = jsonb_build_object('forced_cancel', true, 'cancelled_at', now()::text)
WHERE status = 'executando' 
  AND iniciado_em < now() - interval '30 minutes';

-- Limpar flags de cancelamento para permitir novas execuções
UPDATE configuracoes_monitoramento 
SET metadata = jsonb_set(
  COALESCE(metadata, '{}'::jsonb),
  '{cancelado}',
  'false'::jsonb
)
WHERE coordenacao_id IS NULL 
  AND (metadata->>'cancelado')::boolean = true;