ALTER TABLE public.classificacao_relatores_tst
  ADD COLUMN IF NOT EXISTS turma_id uuid NULL
  REFERENCES public.classificacao_turmas_tst(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_classificacao_relatores_tst_turma_id
  ON public.classificacao_relatores_tst(turma_id);