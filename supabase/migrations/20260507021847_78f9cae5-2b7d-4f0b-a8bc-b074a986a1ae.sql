
ALTER TABLE public.dados_benner
  ADD COLUMN IF NOT EXISTS em_analise boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS em_analise_por uuid,
  ADD COLUMN IF NOT EXISTS em_analise_em timestamptz;

CREATE INDEX IF NOT EXISTS idx_dados_benner_em_analise
  ON public.dados_benner (em_analise)
  WHERE em_analise = true;
