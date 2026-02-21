
ALTER TABLE public.publicacoes_djen
  ADD COLUMN IF NOT EXISTS orgao text,
  ADD COLUMN IF NOT EXISTS tipo_comunicacao text,
  ADD COLUMN IF NOT EXISTS meio text,
  ADD COLUMN IF NOT EXISTS advogados_json jsonb;
