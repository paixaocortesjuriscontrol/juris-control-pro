-- Tabela para relacionar tarefas diretamente (sem depender de processo)
CREATE TABLE public.tarefas_relacionadas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tarefa_origem_id UUID NOT NULL REFERENCES public.tarefas(id) ON DELETE CASCADE,
  tarefa_relacionada_id UUID NOT NULL REFERENCES public.tarefas(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  criado_por UUID REFERENCES public.profiles(id),
  
  -- Evitar duplicatas e auto-relacionamento
  CONSTRAINT tarefas_relacionadas_unique UNIQUE (tarefa_origem_id, tarefa_relacionada_id),
  CONSTRAINT tarefas_relacionadas_no_self CHECK (tarefa_origem_id <> tarefa_relacionada_id)
);

-- Índices para performance
CREATE INDEX idx_tarefas_relacionadas_origem ON public.tarefas_relacionadas(tarefa_origem_id);
CREATE INDEX idx_tarefas_relacionadas_relacionada ON public.tarefas_relacionadas(tarefa_relacionada_id);

-- Habilitar RLS
ALTER TABLE public.tarefas_relacionadas ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso
CREATE POLICY "Usuários podem ver relacionamentos de tarefas"
ON public.tarefas_relacionadas
FOR SELECT
USING (true);

CREATE POLICY "Usuários autenticados podem criar relacionamentos"
ON public.tarefas_relacionadas
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Usuários podem deletar relacionamentos que criaram"
ON public.tarefas_relacionadas
FOR DELETE
USING (auth.uid() = criado_por);