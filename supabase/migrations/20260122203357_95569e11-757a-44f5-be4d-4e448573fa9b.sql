-- Resetar estado inconsistente da Monitoração 360 (termos)
-- O problema: paused_globally=true + status=em_andamento + continuingRun=true
-- mas não há execução ativa (todas finalizadas)
UPDATE configuracoes_monitoramento
SET metadata = jsonb_set(
  jsonb_set(
    jsonb_set(
      jsonb_set(
        COALESCE(metadata, '{}'::jsonb),
        '{status}',
        '"idle"'::jsonb,
        true
      ),
      '{continuingRun}',
      'false'::jsonb,
      true
    ),
    '{paused_globally}',
    'false'::jsonb,
    true
  ),
  '{cancelado}',
  'false'::jsonb,
  true
)
WHERE tipo = 'termos';