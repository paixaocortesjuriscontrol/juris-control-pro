ALTER TABLE public.pecas_geradas
  ADD COLUMN IF NOT EXISTS revisado_por uuid,
  ADD COLUMN IF NOT EXISTS revisado_em timestamptz;