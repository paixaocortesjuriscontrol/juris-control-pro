ALTER TABLE public.dados_benner
  ADD COLUMN IF NOT EXISTS somente_outra_materia boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_dados_benner_somente_outra_materia
  ON public.dados_benner (somente_outra_materia)
  WHERE somente_outra_materia;