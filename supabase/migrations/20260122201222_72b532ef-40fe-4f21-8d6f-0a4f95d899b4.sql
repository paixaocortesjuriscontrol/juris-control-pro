-- Corrigir metadata do termos para estado correto (não running)
UPDATE configuracoes_monitoramento
SET metadata = jsonb_set(
  COALESCE(metadata, '{}'::jsonb),
  '{status}',
  '"idle"'::jsonb
)
WHERE tipo = 'termos' 
  AND (metadata->>'status' IS NULL OR metadata->>'status' NOT IN ('em_andamento'));