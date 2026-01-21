
-- ÍNDICES PARA ACELERAR MONITORAMENTOS

-- 1. alertas_monitoramento - tabela mais problemática (357k linhas)
CREATE INDEX IF NOT EXISTS idx_alertas_monitoramento_processo_id 
  ON public.alertas_monitoramento(processo_id);

CREATE INDEX IF NOT EXISTS idx_alertas_monitoramento_created_at 
  ON public.alertas_monitoramento(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_alertas_monitoramento_termo 
  ON public.alertas_monitoramento(termo_id);

-- 2. djen_tribunais_lote - praticamente sem índices
CREATE INDEX IF NOT EXISTS idx_djen_tribunais_lote_lote_id 
  ON public.djen_tribunais_lote(lote_id);

CREATE INDEX IF NOT EXISTS idx_djen_tribunais_lote_run_id 
  ON public.djen_tribunais_lote(run_id);

CREATE INDEX IF NOT EXISTS idx_djen_tribunais_lote_tribunal 
  ON public.djen_tribunais_lote(tribunal);

-- 3. notificacoes - lenta para queries de usuário
CREATE INDEX IF NOT EXISTS idx_notificacoes_usuario_lida 
  ON public.notificacoes(usuario_id, lida) WHERE lida = false;

CREATE INDEX IF NOT EXISTS idx_notificacoes_created_at 
  ON public.notificacoes(created_at DESC);

-- 4. movimentacoes - muitos scans em queries de andamentos
CREATE INDEX IF NOT EXISTS idx_movimentacoes_processo_data 
  ON public.movimentacoes(processo_id, data_movimentacao DESC);

CREATE INDEX IF NOT EXISTS idx_movimentacoes_created_at 
  ON public.movimentacoes(created_at DESC);

-- 5. processos - índices para monitoramento
CREATE INDEX IF NOT EXISTS idx_processos_monitorar_andamentos 
  ON public.processos(id) WHERE monitorar_andamentos = true;

CREATE INDEX IF NOT EXISTS idx_processos_coordenacao_id 
  ON public.processos(coordenacao_id);

-- 6. historico_monitoramento - para queries de relatório (coluna: executado_em)
CREATE INDEX IF NOT EXISTS idx_historico_monitoramento_tipo_data 
  ON public.historico_monitoramento(tipo, executado_em DESC);

-- 7. tarefas - para queries de delegação
CREATE INDEX IF NOT EXISTS idx_tarefas_responsavel_status 
  ON public.tarefas(responsavel_id, status);

CREATE INDEX IF NOT EXISTS idx_tarefas_processo_id 
  ON public.tarefas(processo_id);

-- 8. Analyze para atualizar estatísticas do query planner
ANALYZE public.alertas_monitoramento;
ANALYZE public.djen_tribunais_lote;
ANALYZE public.notificacoes;
ANALYZE public.movimentacoes;
ANALYZE public.processos;
ANALYZE public.tarefas;
ANALYZE public.historico_monitoramento;
