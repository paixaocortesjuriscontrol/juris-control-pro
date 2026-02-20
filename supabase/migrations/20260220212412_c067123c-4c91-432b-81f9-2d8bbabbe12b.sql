
-- Corrigir a política RLS de SELECT em tarefas para permitir que
-- o criador da tarefa também possa visualizá-la, mesmo que o responsável seja outro usuário.

DROP POLICY IF EXISTS "Users can view prazos of accessible processos or own" ON public.tarefas;

CREATE POLICY "Users can view prazos of accessible processos or own"
ON public.tarefas
FOR SELECT
USING (
  is_user_active(auth.uid()) AND (
    (processo_id IS NULL) OR 
    can_access_processo(auth.uid(), processo_id) OR 
    (responsavel_id = auth.uid()) OR
    (criado_por = auth.uid())
  )
);
