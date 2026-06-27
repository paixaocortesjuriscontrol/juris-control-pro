ALTER TABLE public.dados_benner
  ADD COLUMN IF NOT EXISTS materias_analise_reclamante jsonb,
  ADD COLUMN IF NOT EXISTS materias_analise_banco jsonb,
  ADD COLUMN IF NOT EXISTS tem_chance_exito_reclamante text,
  ADD COLUMN IF NOT EXISTS tem_chance_exito_banco text,
  ADD COLUMN IF NOT EXISTS tem_chance_exito_terceiro text,
  ADD COLUMN IF NOT EXISTS risco_nivel text;