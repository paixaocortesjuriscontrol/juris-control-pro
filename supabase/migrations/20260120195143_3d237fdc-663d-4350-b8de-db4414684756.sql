-- Adicionar coluna 'lida' na tabela publicacoes_djen_descartadas
ALTER TABLE public.publicacoes_djen_descartadas 
ADD COLUMN IF NOT EXISTS lida BOOLEAN NOT NULL DEFAULT false;