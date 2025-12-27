-- Índices para melhorar performance de consultas na tabela processos
CREATE INDEX IF NOT EXISTS idx_processos_status ON public.processos(status);
CREATE INDEX IF NOT EXISTS idx_processos_area ON public.processos(area);
CREATE INDEX IF NOT EXISTS idx_processos_coordenacao_id ON public.processos(coordenacao_id);
CREATE INDEX IF NOT EXISTS idx_processos_advogado_responsavel_id ON public.processos(advogado_responsavel_id);
CREATE INDEX IF NOT EXISTS idx_processos_cliente_id ON public.processos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_processos_created_at ON public.processos(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_processos_numero ON public.processos(numero);
CREATE INDEX IF NOT EXISTS idx_processos_pasta_id ON public.processos(pasta_id);

-- Índice composto para filtros comuns
CREATE INDEX IF NOT EXISTS idx_processos_status_area ON public.processos(status, area);
CREATE INDEX IF NOT EXISTS idx_processos_coordenacao_status ON public.processos(coordenacao_id, status);

-- Índices para tabelas relacionadas frequentemente consultadas
CREATE INDEX IF NOT EXISTS idx_prazos_processo_id ON public.prazos(processo_id);
CREATE INDEX IF NOT EXISTS idx_prazos_status ON public.prazos(status);
CREATE INDEX IF NOT EXISTS idx_prazos_data_vencimento ON public.prazos(data_vencimento);
CREATE INDEX IF NOT EXISTS idx_prazos_responsavel_id ON public.prazos(responsavel_id);

CREATE INDEX IF NOT EXISTS idx_movimentacoes_processo_id ON public.movimentacoes(processo_id);
CREATE INDEX IF NOT EXISTS idx_movimentacoes_data ON public.movimentacoes(data_movimentacao DESC);

CREATE INDEX IF NOT EXISTS idx_membros_coordenacao_usuario_id ON public.membros_coordenacao(usuario_id);
CREATE INDEX IF NOT EXISTS idx_membros_coordenacao_coordenacao_id ON public.membros_coordenacao(coordenacao_id);

-- Índices para profiles
CREATE INDEX IF NOT EXISTS idx_profiles_ativo ON public.profiles(ativo);

-- Índices para user_roles
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON public.user_roles(role);