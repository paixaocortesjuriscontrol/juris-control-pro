-- Forçar parada completa do DJEN Termos
UPDATE configuracoes_monitoramento 
SET 
  ativo = false,
  metadata = jsonb_set(
    jsonb_set(
      jsonb_set(
        COALESCE(metadata, '{}'::jsonb),
        '{cancelado}', 'true'
      ),
      '{continuingRun}', 'false'
    ),
    '{status}', '"idle"'
  )
WHERE tipo = 'djen';

-- Cancelar qualquer execução ativa relacionada
UPDATE execucoes_agendadas 
SET status = 'cancelado', 
    finalizado_em = now()
WHERE tipo ILIKE '%djen%' 
  AND finalizado_em IS NULL;