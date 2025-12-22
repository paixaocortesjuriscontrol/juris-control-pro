-- Adicionar campo resumo_ia na tabela publicacoes_djen
ALTER TABLE public.publicacoes_djen 
ADD COLUMN resumo_ia TEXT;

-- Adicionar campo para armazenar quando o resumo foi gerado
ALTER TABLE public.publicacoes_djen 
ADD COLUMN resumo_gerado_em TIMESTAMP WITH TIME ZONE;