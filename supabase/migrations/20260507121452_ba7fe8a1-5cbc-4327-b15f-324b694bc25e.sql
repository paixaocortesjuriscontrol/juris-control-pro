ALTER TABLE public.dados_benner
  ADD COLUMN IF NOT EXISTS problema_judit boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS problema_judit_em timestamptz,
  ADD COLUMN IF NOT EXISTS problema_judit_por uuid;

CREATE INDEX IF NOT EXISTS idx_dados_benner_problema_judit
  ON public.dados_benner (problema_judit) WHERE problema_judit = true;