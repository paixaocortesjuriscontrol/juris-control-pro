-- Criar índice composto para dedup rápida de alertas (movimentacao_id + termo_id)
-- Isso acelera drasticamente a verificação "já existe alerta para essa movimentação/termo?"
CREATE INDEX IF NOT EXISTS idx_alertas_monitoramento_mov_termo 
ON public.alertas_monitoramento (movimentacao_id, termo_id);

-- Também criar índice para audiencias_detectadas e intimacoes_detectadas por movimentacao_id
CREATE INDEX IF NOT EXISTS idx_audiencias_detectadas_mov_id 
ON public.audiencias_detectadas (movimentacao_id) 
WHERE movimentacao_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_intimacoes_detectadas_mov_id 
ON public.intimacoes_detectadas (movimentacao_id) 
WHERE movimentacao_id IS NOT NULL;