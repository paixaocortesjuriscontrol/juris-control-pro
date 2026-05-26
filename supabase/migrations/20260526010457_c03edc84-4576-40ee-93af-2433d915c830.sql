UPDATE public.configuracoes_monitoramento
SET metadata = jsonb_set(
  COALESCE(metadata, '{}'::jsonb),
  '{base_url}',
  to_jsonb('https://www.kurierservicos.com.br/wsservicos'::text),
  true
),
updated_at = now()
WHERE tipo = 'kurier';