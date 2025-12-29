-- Índices para melhorar performance da tabela prazos
CREATE INDEX IF NOT EXISTS idx_prazos_data_vencimento ON public.prazos(data_vencimento);
CREATE INDEX IF NOT EXISTS idx_prazos_status ON public.prazos(status);
CREATE INDEX IF NOT EXISTS idx_prazos_prioridade ON public.prazos(prioridade);
CREATE INDEX IF NOT EXISTS idx_prazos_responsavel_id ON public.prazos(responsavel_id);
CREATE INDEX IF NOT EXISTS idx_prazos_processo_id ON public.prazos(processo_id);

-- Índice composto para filtros comuns
CREATE INDEX IF NOT EXISTS idx_prazos_status_data ON public.prazos(status, data_vencimento);