-- Adicionar coluna coordenacao_id à tabela monitoramentos_djen
ALTER TABLE public.monitoramentos_djen 
ADD COLUMN coordenacao_id uuid REFERENCES public.coordenacoes(id);

-- Criar índice para melhor performance
CREATE INDEX idx_monitoramentos_djen_coordenacao ON public.monitoramentos_djen(coordenacao_id);