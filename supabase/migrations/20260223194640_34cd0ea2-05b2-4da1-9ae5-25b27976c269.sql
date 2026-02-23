ALTER TABLE public.publicacoes_djen_descartadas
  ADD COLUMN IF NOT EXISTS orgao text,
  ADD COLUMN IF NOT EXISTS tipo_comunicacao text,
  ADD COLUMN IF NOT EXISTS meio text,
  ADD COLUMN IF NOT EXISTS partes_json jsonb,
  ADD COLUMN IF NOT EXISTS advogados_json jsonb;