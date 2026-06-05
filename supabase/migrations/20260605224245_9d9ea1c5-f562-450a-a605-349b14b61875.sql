ALTER TABLE public.audiencias_detectadas
  ADD COLUMN IF NOT EXISTS titulo text,
  ADD COLUMN IF NOT EXISTS hora_fim text,
  ADD COLUMN IF NOT EXISTS alerta_valor integer,
  ADD COLUMN IF NOT EXISTS alerta_unidade text,
  ADD COLUMN IF NOT EXISTS forum text,
  ADD COLUMN IF NOT EXISTS sala_forum text;