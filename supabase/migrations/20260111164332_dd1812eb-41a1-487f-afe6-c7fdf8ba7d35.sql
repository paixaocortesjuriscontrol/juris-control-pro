-- Adicionar campos de categorização aos documentos de processos
ALTER TABLE public.documentos 
ADD COLUMN IF NOT EXISTS categoria TEXT,
ADD COLUMN IF NOT EXISTS tipo_documento TEXT,
ADD COLUMN IF NOT EXISTS descricao TEXT,
ADD COLUMN IF NOT EXISTS tags TEXT[],
ADD COLUMN IF NOT EXISTS analisado_ia BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS confianca_ia TEXT;

-- Adicionar comentários
COMMENT ON COLUMN public.documentos.categoria IS 'Categoria do documento classificada por IA';
COMMENT ON COLUMN public.documentos.tipo_documento IS 'Tipo específico do documento';
COMMENT ON COLUMN public.documentos.descricao IS 'Descrição gerada ou manual do documento';
COMMENT ON COLUMN public.documentos.tags IS 'Tags para facilitar busca';
COMMENT ON COLUMN public.documentos.analisado_ia IS 'Se o documento foi analisado pela IA';
COMMENT ON COLUMN public.documentos.confianca_ia IS 'Nível de confiança da classificação IA';