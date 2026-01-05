-- Adicionar coluna prazo_id na tabela documentos para vincular documentos a tarefas
ALTER TABLE public.documentos 
ADD COLUMN IF NOT EXISTS prazo_id uuid REFERENCES public.prazos(id) ON DELETE CASCADE;

-- Criar índice para melhor performance
CREATE INDEX IF NOT EXISTS idx_documentos_prazo_id ON public.documentos(prazo_id);

-- Atualizar RLS policy para permitir acesso aos documentos vinculados a prazos
DROP POLICY IF EXISTS "Usuários autenticados podem ver documentos" ON public.documentos;

CREATE POLICY "Usuários autenticados podem ver documentos"
ON public.documentos FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Usuários autenticados podem inserir documentos" ON public.documentos;

CREATE POLICY "Usuários autenticados podem inserir documentos"
ON public.documentos FOR INSERT
TO authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "Usuários autenticados podem atualizar documentos" ON public.documentos;

CREATE POLICY "Usuários autenticados podem atualizar documentos"
ON public.documentos FOR UPDATE
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Usuários autenticados podem deletar documentos" ON public.documentos;

CREATE POLICY "Usuários autenticados podem deletar documentos"
ON public.documentos FOR DELETE
TO authenticated
USING (true);