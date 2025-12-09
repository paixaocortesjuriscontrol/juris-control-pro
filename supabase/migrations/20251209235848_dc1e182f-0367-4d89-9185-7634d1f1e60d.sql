-- Add Projuris-specific columns to processos table
ALTER TABLE public.processos 
ADD COLUMN IF NOT EXISTS identificador_projuris TEXT,
ADD COLUMN IF NOT EXISTS pasta_fisica TEXT,
ADD COLUMN IF NOT EXISTS pasta_cliente TEXT,
ADD COLUMN IF NOT EXISTS justica TEXT,
ADD COLUMN IF NOT EXISTS instancia TEXT,
ADD COLUMN IF NOT EXISTS fase TEXT,
ADD COLUMN IF NOT EXISTS data_citacao DATE,
ADD COLUMN IF NOT EXISTS data_recebimento DATE,
ADD COLUMN IF NOT EXISTS data_arquivamento DATE,
ADD COLUMN IF NOT EXISTS valor_provisionado NUMERIC,
ADD COLUMN IF NOT EXISTS probabilidade TEXT,
ADD COLUMN IF NOT EXISTS risco TEXT,
ADD COLUMN IF NOT EXISTS transitado_julgado BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS resultado TEXT,
ADD COLUMN IF NOT EXISTS valor_condenacao NUMERIC,
ADD COLUMN IF NOT EXISTS uf TEXT,
ADD COLUMN IF NOT EXISTS responsaveis_projuris TEXT;

-- Add index for Projuris identifier for faster lookups
CREATE INDEX IF NOT EXISTS idx_processos_identificador_projuris ON public.processos(identificador_projuris);