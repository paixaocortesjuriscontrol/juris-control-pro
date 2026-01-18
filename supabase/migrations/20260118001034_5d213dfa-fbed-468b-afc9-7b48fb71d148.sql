-- Adicionar coluna processo_id na tabela repositorio_documentos
ALTER TABLE public.repositorio_documentos 
ADD COLUMN processo_id UUID REFERENCES public.processos(id) ON DELETE SET NULL;

-- Adicionar índice para melhor performance
CREATE INDEX idx_repositorio_documentos_processo_id ON public.repositorio_documentos(processo_id);

-- Adicionar coluna para armazenar o número do processo extraído (mesmo se não encontrado)
ALTER TABLE public.repositorio_documentos 
ADD COLUMN numero_processo_extraido TEXT;