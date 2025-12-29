-- Permitir processo_id opcional na tabela prazos para suportar importação de tarefas Projuris sem vínculo
ALTER TABLE public.prazos 
  ALTER COLUMN processo_id DROP NOT NULL;

-- Adicionar campos extras para dados do Projuris
ALTER TABLE public.prazos
  ADD COLUMN IF NOT EXISTS identificador_projuris TEXT,
  ADD COLUMN IF NOT EXISTS tipo_tarefa TEXT,
  ADD COLUMN IF NOT EXISTS data_base DATE,
  ADD COLUMN IF NOT EXISTS data_fatal DATE,
  ADD COLUMN IF NOT EXISTS criado_por_nome TEXT,
  ADD COLUMN IF NOT EXISTS concluido_por_nome TEXT,
  ADD COLUMN IF NOT EXISTS grupos_trabalho TEXT,
  ADD COLUMN IF NOT EXISTS marcadores TEXT,
  ADD COLUMN IF NOT EXISTS quadro_kanban TEXT;

-- Criar índice para lookup rápido de tarefas Projuris
CREATE INDEX IF NOT EXISTS idx_prazos_identificador_projuris 
  ON public.prazos(identificador_projuris) 
  WHERE identificador_projuris IS NOT NULL;

-- Atualizar política RLS para permitir tarefas sem processo
DROP POLICY IF EXISTS "Users can manage prazos of accessible processos or own" ON public.prazos;
DROP POLICY IF EXISTS "Users can view prazos of accessible processos or own" ON public.prazos;

CREATE POLICY "Users can manage prazos of accessible processos or own" 
ON public.prazos 
FOR ALL
USING (
  is_user_active(auth.uid()) 
  AND (
    processo_id IS NULL 
    OR can_access_processo(auth.uid(), processo_id) 
    OR responsavel_id = auth.uid()
  )
);

CREATE POLICY "Users can view prazos of accessible processos or own" 
ON public.prazos 
FOR SELECT
USING (
  is_user_active(auth.uid()) 
  AND (
    processo_id IS NULL 
    OR can_access_processo(auth.uid(), processo_id) 
    OR responsavel_id = auth.uid()
  )
);