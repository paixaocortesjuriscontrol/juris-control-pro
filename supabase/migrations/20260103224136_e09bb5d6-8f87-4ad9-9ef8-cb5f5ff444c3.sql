-- Adicionar campos do Ministério Público na tabela processos
ALTER TABLE public.processos
ADD COLUMN IF NOT EXISTS localidade text,
ADD COLUMN IF NOT EXISTS autor text,
ADD COLUMN IF NOT EXISTS requerido text,
ADD COLUMN IF NOT EXISTS materia_mpt text,
ADD COLUMN IF NOT EXISTS ultimo_andamento_mpt text,
ADD COLUMN IF NOT EXISTS observacao_advogado text;