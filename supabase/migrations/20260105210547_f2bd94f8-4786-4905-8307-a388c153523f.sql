-- Adicionar campo criado_por para vincular tarefas ao criador
ALTER TABLE public.prazos 
ADD COLUMN IF NOT EXISTS criado_por UUID REFERENCES auth.users(id);

-- Criar índice para performance
CREATE INDEX IF NOT EXISTS idx_prazos_criado_por ON public.prazos(criado_por);