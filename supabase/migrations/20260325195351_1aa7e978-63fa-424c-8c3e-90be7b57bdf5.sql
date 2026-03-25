-- Índice para a página de Prazos Fatais (filtra por coordenacao_id, ordena por data_fatal)
CREATE INDEX IF NOT EXISTS idx_processos_coord_data_fatal
  ON public.processos (coordenacao_id, data_fatal ASC NULLS LAST);

-- Índice para queries de tarefas por responsável (Minha Carteira)
CREATE INDEX IF NOT EXISTS idx_tarefas_responsavel_status
  ON public.tarefas (responsavel_id, status, data_vencimento);

-- Índice para queries de tarefas por processo (usado em contagem N+1)
CREATE INDEX IF NOT EXISTS idx_tarefas_processo_status
  ON public.tarefas (processo_id, status);

-- Índice para processos por advogado responsável (Minha Carteira)
CREATE INDEX IF NOT EXISTS idx_processos_advogado_status
  ON public.processos (advogado_responsavel_id, status);