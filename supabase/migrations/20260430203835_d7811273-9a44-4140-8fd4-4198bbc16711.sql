DELETE FROM public.dados_benner
WHERE id = '1e93fa3f-fd2c-4508-874b-59d3407ecb4c';

CREATE UNIQUE INDEX IF NOT EXISTS dados_benner_processo_sem_dossie_uniq
  ON public.dados_benner (processo)
  WHERE dossie IS NULL OR dossie = '';