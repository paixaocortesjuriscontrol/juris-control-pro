-- Tabela de vínculo N:N entre tarefas e publicações DJEN de PROCESSOS
CREATE TABLE public.tarefas_publicacoes_processos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tarefa_id UUID NOT NULL REFERENCES public.tarefas(id) ON DELETE CASCADE,
  publicacao_processo_id UUID NOT NULL REFERENCES public.publicacoes_djen_processos(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(tarefa_id, publicacao_processo_id)
);

-- Enable RLS
ALTER TABLE public.tarefas_publicacoes_processos ENABLE ROW LEVEL SECURITY;

-- Políticas permissivas para usuários autenticados
CREATE POLICY "Usuários autenticados podem visualizar" 
ON public.tarefas_publicacoes_processos 
FOR SELECT 
TO authenticated
USING (true);

CREATE POLICY "Usuários autenticados podem inserir" 
ON public.tarefas_publicacoes_processos 
FOR INSERT 
TO authenticated
WITH CHECK (true);

CREATE POLICY "Usuários autenticados podem deletar" 
ON public.tarefas_publicacoes_processos 
FOR DELETE 
TO authenticated
USING (true);

-- Índices para performance
CREATE INDEX idx_tarefas_publicacoes_processos_tarefa ON public.tarefas_publicacoes_processos(tarefa_id);
CREATE INDEX idx_tarefas_publicacoes_processos_publicacao ON public.tarefas_publicacoes_processos(publicacao_processo_id);