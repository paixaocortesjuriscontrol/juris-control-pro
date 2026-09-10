ALTER TABLE public.workflow_execucoes
  ADD COLUMN publicacao_origem_tipo text,
  ADD COLUMN publicacao_origem_id uuid;

CREATE INDEX workflow_execucoes_publicacao_origem_idx
  ON public.workflow_execucoes (publicacao_origem_tipo, publicacao_origem_id)
  WHERE publicacao_origem_id IS NOT NULL;

COMMENT ON COLUMN public.workflow_execucoes.publicacao_origem_tipo IS 'Origem da publicação que iniciou a execução: termo, processo, descartada ou datajud.';
COMMENT ON COLUMN public.workflow_execucoes.publicacao_origem_id IS 'Identificador da publicação que iniciou a execução.';