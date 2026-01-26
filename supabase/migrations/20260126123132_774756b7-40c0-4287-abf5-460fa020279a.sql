
-- Forçar cancelamento AGORA para parar o processo ativo
UPDATE configuracoes_monitoramento
SET metadata = metadata || jsonb_build_object(
  'cancelado', true,
  'paused_globally', true,
  'continuingRun', false
)
WHERE tipo = 'djen';
