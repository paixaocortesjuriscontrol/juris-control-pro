-- Atualizar registros que têm data_limite mas faltam data_intimacao/data_disponibilizacao
UPDATE public.intimacoes_detectadas
SET 
  data_intimacao = (data_limite::date - (COALESCE(prazo_dias, 5) || ' days')::interval)::timestamptz,
  data_disponibilizacao = (data_limite::date - (COALESCE(prazo_dias, 5) + 1 || ' days')::interval)::timestamptz
WHERE data_limite IS NOT NULL 
  AND (data_intimacao IS NULL OR data_disponibilizacao IS NULL);

-- Atualizar registros que não têm data_limite mas têm created_at
UPDATE public.intimacoes_detectadas
SET 
  data_disponibilizacao = COALESCE(data_disponibilizacao, created_at),
  data_intimacao = COALESCE(data_intimacao, created_at + interval '1 day'),
  data_limite = COALESCE(data_limite, created_at + (COALESCE(prazo_dias, 5) || ' days')::interval),
  prazo_dias = COALESCE(prazo_dias, 5)
WHERE data_limite IS NULL OR data_intimacao IS NULL OR data_disponibilizacao IS NULL;