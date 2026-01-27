
-- =============================================================
-- ÍNDICES PARA OTIMIZAÇÃO DE PUBLICACOES_DJEN
-- =============================================================

-- Índice composto para filtros de data + lida (usado em todas as queries)
CREATE INDEX IF NOT EXISTS idx_publicacoes_djen_created_at_lida 
ON public.publicacoes_djen (created_at DESC, lida);

-- Índice para buscas por processo_numero (muito usado em deduplicação)
CREATE INDEX IF NOT EXISTS idx_publicacoes_djen_processo_numero 
ON public.publicacoes_djen (processo_numero) 
WHERE processo_numero IS NOT NULL;

-- Índice composto para join + filtro de data (query principal do RPC)
CREATE INDEX IF NOT EXISTS idx_publicacoes_djen_monitoramento_created 
ON public.publicacoes_djen (monitoramento_id, created_at DESC);

-- Índice para filtro de não lidas (muito usado)
CREATE INDEX IF NOT EXISTS idx_publicacoes_djen_nao_lidas 
ON public.publicacoes_djen (monitoramento_id, created_at DESC) 
WHERE lida = false;

-- =============================================================
-- ÍNDICES PARA OTIMIZAÇÃO DE PUBLICACOES_DJEN_PROCESSOS
-- =============================================================

-- Índice para join com processos + filtro de data
CREATE INDEX IF NOT EXISTS idx_publicacoes_djen_processos_created 
ON public.publicacoes_djen_processos (processo_id, created_at DESC);

-- Índice para filtro de não lidas
CREATE INDEX IF NOT EXISTS idx_publicacoes_djen_processos_nao_lidas 
ON public.publicacoes_djen_processos (processo_id, created_at DESC) 
WHERE lida = false;

-- Índice para created_at + lida
CREATE INDEX IF NOT EXISTS idx_publicacoes_djen_processos_created_lida 
ON public.publicacoes_djen_processos (created_at DESC, lida);

-- =============================================================
-- ÍNDICES PARA OTIMIZAÇÃO DE MONITORAMENTOS_DJEN
-- =============================================================

-- Índice composto para join frequente (coordenacao + ativo)
CREATE INDEX IF NOT EXISTS idx_monitoramentos_djen_coordenacao_ativo 
ON public.monitoramentos_djen (coordenacao_id, ativo) 
WHERE ativo = true;

-- =============================================================
-- ATUALIZAR ESTATÍSTICAS DAS TABELAS
-- =============================================================
ANALYZE public.publicacoes_djen;
ANALYZE public.publicacoes_djen_processos;
ANALYZE public.monitoramentos_djen;
