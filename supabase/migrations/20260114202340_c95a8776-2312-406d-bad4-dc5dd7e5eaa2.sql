-- Índices compostos para otimização de relatórios
-- Estes índices aceleram os JOINs e agregações usados nas funções de relatório

-- 1. Índice composto para get_relatorio_tarefas (status + processo_id para JOIN eficiente)
CREATE INDEX IF NOT EXISTS idx_tarefas_status_processo 
ON public.tarefas (status, processo_id);

-- 2. Índice para contagem rápida de tarefas por status (covering index)
CREATE INDEX IF NOT EXISTS idx_tarefas_status_only 
ON public.tarefas (status) INCLUDE (id);

-- 3. Índice composto em movimentacoes para JOIN com processos por área
CREATE INDEX IF NOT EXISTS idx_movimentacoes_processo_data 
ON public.movimentacoes (processo_id, data_movimentacao);

-- 4. Índice composto em processos para relatório de clientes
CREATE INDEX IF NOT EXISTS idx_processos_cliente_status_area 
ON public.processos (cliente_id, status, area);

-- 5. Índice para processos_responsaveis usado no relatório de produtividade
CREATE INDEX IF NOT EXISTS idx_processos_responsaveis_usuario 
ON public.processos_responsaveis (usuario_id);

-- 6. Índice parcial para processos ativos (muito usado nos relatórios)
CREATE INDEX IF NOT EXISTS idx_processos_ativos_created 
ON public.processos (created_at) 
WHERE status = 'ativo';

-- 7. Índice para tipo de cliente no relatório de resumo
CREATE INDEX IF NOT EXISTS idx_clientes_tipo 
ON public.clientes (tipo);