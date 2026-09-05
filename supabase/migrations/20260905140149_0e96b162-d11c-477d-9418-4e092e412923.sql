ALTER TABLE public.dados_benner
  ADD COLUMN IF NOT EXISTS revisar_lista_materias boolean;

CREATE INDEX IF NOT EXISTS idx_dados_benner_revisar_lista_materias
  ON public.dados_benner (id)
  WHERE revisar_lista_materias = true;