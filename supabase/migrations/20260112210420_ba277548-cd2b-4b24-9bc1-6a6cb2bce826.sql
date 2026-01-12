-- Tabela de vínculo N:N entre tarefas e publicações DJEN
CREATE TABLE public.tarefas_publicacoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tarefa_id UUID NOT NULL REFERENCES public.tarefas(id) ON DELETE CASCADE,
  publicacao_id UUID NOT NULL REFERENCES public.publicacoes_djen(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(tarefa_id, publicacao_id)
);

-- Enable RLS
ALTER TABLE public.tarefas_publicacoes ENABLE ROW LEVEL SECURITY;

-- Políticas RLS - qualquer usuário autenticado pode ler e inserir
CREATE POLICY "Usuários autenticados podem ver vínculos"
ON public.tarefas_publicacoes
FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Usuários autenticados podem criar vínculos"
ON public.tarefas_publicacoes
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Usuários autenticados podem deletar vínculos"
ON public.tarefas_publicacoes
FOR DELETE
USING (auth.uid() IS NOT NULL);

-- Índices para performance
CREATE INDEX idx_tarefas_publicacoes_tarefa ON public.tarefas_publicacoes(tarefa_id);
CREATE INDEX idx_tarefas_publicacoes_publicacao ON public.tarefas_publicacoes(publicacao_id);