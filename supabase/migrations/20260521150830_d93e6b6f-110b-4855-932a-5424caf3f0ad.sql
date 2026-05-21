ALTER TABLE public.dados_benner
  ADD COLUMN IF NOT EXISTS tipo_recurso_terceiro text,
  ADD COLUMN IF NOT EXISTS materias_recurso_terceiro text,
  ADD COLUMN IF NOT EXISTS aparelhamento_terceiro text,
  ADD COLUMN IF NOT EXISTS chance_exito_terceiro text;