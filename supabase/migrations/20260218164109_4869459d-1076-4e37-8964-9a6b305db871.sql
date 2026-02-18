
-- Corrigir execução de redistribuições travada (status 'timeout' é válido)
UPDATE public.execucoes_agendadas
SET
  status = 'timeout',
  finalizado_em = NOW(),
  detalhes = (COALESCE(detalhes, '{}'::jsonb)) || 
    '{"interrupcao": {"motivo": "timeout_runtime", "offset_salvo": 14400, "pode_retomar": true}}'::jsonb
WHERE id = 'dda5c347-a728-4036-8411-e1119f4be588'
  AND status = 'executando'
  AND finalizado_em IS NULL;
