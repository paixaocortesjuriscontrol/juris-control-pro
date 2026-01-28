-- Limpar execuções fantasmas do DJEN Processos
UPDATE execucoes_agendadas 
SET status = 'cancelado', finalizado_em = COALESCE(finalizado_em, NOW())
WHERE tipo = 'djen_processos' 
AND status IN ('executando', 'iniciado');

-- Resetar metadata para idle
UPDATE configuracoes_monitoramento 
SET metadata = jsonb_set(
  jsonb_set(
    jsonb_set(
      jsonb_set(metadata, '{status}', '"idle"'),
      '{cancelado}', 'true'
    ),
    '{continuingRun}', 'false'
  ),
  '{paused_globally}', 'true'
)
WHERE tipo = 'djen_processos';