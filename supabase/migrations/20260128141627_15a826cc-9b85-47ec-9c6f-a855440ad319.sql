-- Limpar execuções fantasmas que travaram
UPDATE execucoes_agendadas 
SET status = 'timeout', finalizado_em = NOW() 
WHERE tipo = 'djen_processos' 
AND status = 'executando' 
AND (finalizado_em IS NULL OR iniciado_em < NOW() - INTERVAL '30 minutes');

-- Ajustar metadata para permitir retomada do offset 8500
UPDATE configuracoes_monitoramento 
SET metadata = jsonb_set(
  jsonb_set(
    jsonb_set(
      jsonb_set(metadata, '{status}', '"idle"'),
      '{continuingRun}', 'false'
    ),
    '{pode_retomar}', 'true'
  ),
  '{cancelado}', 'false'
)
WHERE tipo = 'djen_processos';