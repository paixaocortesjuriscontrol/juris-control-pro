update configuracoes_monitoramento
set metadata = jsonb_set(
  coalesce(metadata, '{}'::jsonb),
  '{cancelado}',
  'true'::jsonb,
  true
)
where tipo = 'djen';

update configuracoes_monitoramento
set metadata = jsonb_set(
  jsonb_set(
    jsonb_set(
      jsonb_set(coalesce(metadata, '{}'::jsonb), '{status}', '"cancelado"', true),
      '{has_more}', 'false', true
    ),
    '{next_offset}', 'null', true
  ),
  '{djen_run}', 'null', true
)
where tipo = 'djen';