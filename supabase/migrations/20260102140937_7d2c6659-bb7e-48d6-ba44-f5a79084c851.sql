-- Indexes for processos table (main queries)
CREATE INDEX IF NOT EXISTS idx_processos_created_at ON public.processos (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_processos_area ON public.processos (area);
CREATE INDEX IF NOT EXISTS idx_processos_status ON public.processos (status);
CREATE INDEX IF NOT EXISTS idx_processos_coordenacao_id ON public.processos (coordenacao_id);
CREATE INDEX IF NOT EXISTS idx_processos_advogado_responsavel_id ON public.processos (advogado_responsavel_id);
CREATE INDEX IF NOT EXISTS idx_processos_instancia ON public.processos (instancia);

-- Composite index for common filter combinations
CREATE INDEX IF NOT EXISTS idx_processos_filters ON public.processos (status, area, coordenacao_id, created_at DESC);

-- Indexes for EXISTS subqueries
CREATE INDEX IF NOT EXISTS idx_publicacoes_djen_processos_processo_id ON public.publicacoes_djen_processos (processo_id);
CREATE INDEX IF NOT EXISTS idx_movimentacoes_processo_id ON public.movimentacoes (processo_id);