ALTER TABLE public.dados_benner
  ADD COLUMN IF NOT EXISTS analisado boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS analisado_em timestamptz,
  ADD COLUMN IF NOT EXISTS analisado_por uuid;

CREATE INDEX IF NOT EXISTS idx_dados_benner_analisado
  ON public.dados_benner (analisado) WHERE analisado = true;