-- Corrigir estado inconsistente do DJEN (tipo='djen'): se não há mais páginas (has_more=false) mas status ficou 'em_andamento', marcar como concluído.
UPDATE configuracoes_monitoramento
SET metadata = jsonb_set(
  jsonb_set(
    COALESCE(metadata, '{}'::jsonb),
    '{status}',
    '"concluido"'::jsonb,
    true
  ),
  '{continuingRun}',
  'false'::jsonb,
  true
)
WHERE tipo = 'djen'
  AND COALESCE((metadata->>'has_more')::boolean, false) = false
  AND (metadata->>'status') = 'em_andamento';