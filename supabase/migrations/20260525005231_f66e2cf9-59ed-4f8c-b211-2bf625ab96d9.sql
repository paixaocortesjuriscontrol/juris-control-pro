-- Indexes to speed up Lista de Atividades page

-- Trigram for ILIKE search on titulo
CREATE INDEX IF NOT EXISTS idx_tarefas_titulo_trgm
  ON public.tarefas USING gin (titulo gin_trgm_ops);

-- Identificador projuris trigram (search uses ilike)
CREATE INDEX IF NOT EXISTS idx_tarefas_identificador_projuris_trgm
  ON public.tarefas USING gin (identificador_projuris gin_trgm_ops);

-- Filter by tipo_tarefa + ordering by data_vencimento
CREATE INDEX IF NOT EXISTS idx_tarefas_tipo_tarefa_data
  ON public.tarefas (tipo_tarefa, data_vencimento);

-- Prioridade + data_vencimento (filter + order)
CREATE INDEX IF NOT EXISTS idx_tarefas_prioridade_data
  ON public.tarefas (prioridade, data_vencimento);

-- Help inner-join with processos coordenacao filter
CREATE INDEX IF NOT EXISTS idx_tarefas_processo_data
  ON public.tarefas (processo_id, data_vencimento);

ANALYZE public.tarefas;