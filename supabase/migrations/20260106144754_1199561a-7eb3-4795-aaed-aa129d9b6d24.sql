-- Adicionar campo movimentacao_id na tabela audiencias_detectadas para rastreamento
ALTER TABLE public.audiencias_detectadas 
ADD COLUMN IF NOT EXISTS movimentacao_id uuid REFERENCES public.movimentacoes(id);

-- Criar índice para busca por movimentação
CREATE INDEX IF NOT EXISTS idx_audiencias_detectadas_movimentacao_id 
ON public.audiencias_detectadas(movimentacao_id);

-- Criar índice para busca por origem
CREATE INDEX IF NOT EXISTS idx_audiencias_detectadas_origem 
ON public.audiencias_detectadas(origem);