
ALTER TABLE public.dados_benner
  ADD COLUMN IF NOT EXISTS ic_duplicado boolean NOT NULL DEFAULT false;

DROP INDEX IF EXISTS public.dados_benner_processo_dossie_uniq;
DROP INDEX IF EXISTS public.dados_benner_processo_sem_dossie_uniq;

CREATE INDEX IF NOT EXISTS dados_benner_processo_dossie_idx
  ON public.dados_benner (processo, dossie);
CREATE INDEX IF NOT EXISTS dados_benner_processo_idx
  ON public.dados_benner (processo);
CREATE INDEX IF NOT EXISTS dados_benner_ic_duplicado_idx
  ON public.dados_benner (ic_duplicado) WHERE ic_duplicado = true;
