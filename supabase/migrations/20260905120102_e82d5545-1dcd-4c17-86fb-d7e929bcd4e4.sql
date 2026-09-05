ALTER TABLE public.dados_benner
  ADD COLUMN IF NOT EXISTS sem_pendencia boolean,
  ADD COLUMN IF NOT EXISTS pendencias_verificado_em timestamp with time zone;

CREATE INDEX IF NOT EXISTS idx_dados_benner_sem_pendencia
  ON public.dados_benner (sem_pendencia)
  WHERE sem_pendencia IS TRUE;