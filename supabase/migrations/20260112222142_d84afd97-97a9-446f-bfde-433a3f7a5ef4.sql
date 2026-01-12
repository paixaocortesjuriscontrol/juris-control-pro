-- Índices para tabela tarefas (usados em useAgendaUnificada)
CREATE INDEX IF NOT EXISTS idx_tarefas_responsavel_id ON public.tarefas(responsavel_id);
CREATE INDEX IF NOT EXISTS idx_tarefas_criado_por ON public.tarefas(criado_por);
CREATE INDEX IF NOT EXISTS idx_tarefas_status ON public.tarefas(status);
CREATE INDEX IF NOT EXISTS idx_tarefas_data_vencimento ON public.tarefas(data_vencimento);
CREATE INDEX IF NOT EXISTS idx_tarefas_processo_id ON public.tarefas(processo_id);

-- Índice composto para consultas de agenda (responsável + status + data)
CREATE INDEX IF NOT EXISTS idx_tarefas_agenda_lookup ON public.tarefas(responsavel_id, status, data_vencimento);
CREATE INDEX IF NOT EXISTS idx_tarefas_criador_lookup ON public.tarefas(criado_por, status, data_vencimento);

-- Índices para tabela eventos_agenda
CREATE INDEX IF NOT EXISTS idx_eventos_agenda_criado_por ON public.eventos_agenda(criado_por);
CREATE INDEX IF NOT EXISTS idx_eventos_agenda_status ON public.eventos_agenda(status);
CREATE INDEX IF NOT EXISTS idx_eventos_agenda_data_inicio ON public.eventos_agenda(data_inicio);
CREATE INDEX IF NOT EXISTS idx_eventos_agenda_lookup ON public.eventos_agenda(criado_por, status, data_inicio);

-- Índices para participantes_evento
CREATE INDEX IF NOT EXISTS idx_participantes_evento_usuario_id ON public.participantes_evento(usuario_id);
CREATE INDEX IF NOT EXISTS idx_participantes_evento_evento_id ON public.participantes_evento(evento_id);

-- Índices para processos (usados em detalhes)
CREATE INDEX IF NOT EXISTS idx_processos_coordenacao_id ON public.processos(coordenacao_id);
CREATE INDEX IF NOT EXISTS idx_processos_cliente_id ON public.processos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_processos_advogado_responsavel_id ON public.processos(advogado_responsavel_id);
CREATE INDEX IF NOT EXISTS idx_processos_status ON public.processos(status);
CREATE INDEX IF NOT EXISTS idx_processos_numero ON public.processos(numero);

-- Índices para comentarios_tarefas
CREATE INDEX IF NOT EXISTS idx_comentarios_tarefas_tarefa_id ON public.comentarios_tarefas(tarefa_id);

-- Índices para publicações vinculadas
CREATE INDEX IF NOT EXISTS idx_tarefas_publicacoes_tarefa_id ON public.tarefas_publicacoes(tarefa_id);
CREATE INDEX IF NOT EXISTS idx_tarefas_publicacoes_publicacao_id ON public.tarefas_publicacoes(publicacao_id);
CREATE INDEX IF NOT EXISTS idx_tarefas_publicacoes_processos_tarefa_id ON public.tarefas_publicacoes_processos(tarefa_id);

-- Índices para publicacoes_djen
CREATE INDEX IF NOT EXISTS idx_publicacoes_djen_monitoramento_id ON public.publicacoes_djen(monitoramento_id);
CREATE INDEX IF NOT EXISTS idx_publicacoes_djen_data_publicacao ON public.publicacoes_djen(data_publicacao);

-- Índices para publicacoes_djen_processos
CREATE INDEX IF NOT EXISTS idx_publicacoes_djen_processos_processo_id ON public.publicacoes_djen_processos(processo_id);