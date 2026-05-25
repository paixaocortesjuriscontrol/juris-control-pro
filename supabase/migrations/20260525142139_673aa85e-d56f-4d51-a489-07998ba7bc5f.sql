-- Speed up Lista de Atividades ordering and common filters
CREATE INDEX IF NOT EXISTS idx_tarefas_created_at_desc
  ON public.tarefas (created_at DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_tarefas_status_created_at_desc
  ON public.tarefas (status, created_at DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_tarefas_prioridade_created_at_desc
  ON public.tarefas (prioridade, created_at DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_tarefas_tipo_tarefa_created_at_desc
  ON public.tarefas (tipo_tarefa, created_at DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_tarefas_responsavel_created_at_desc
  ON public.tarefas (responsavel_id, created_at DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_tarefas_vencimento_created_at_desc
  ON public.tarefas (data_vencimento, created_at DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_tarefas_processo_created_at_desc
  ON public.tarefas (processo_id, created_at DESC NULLS LAST);

ANALYZE public.tarefas;