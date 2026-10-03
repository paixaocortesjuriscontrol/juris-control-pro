DROP POLICY IF EXISTS "Users can manage prazos of accessible processos or own" ON public.tarefas;

CREATE POLICY "Users can manage prazos of accessible processos or own"
ON public.tarefas
FOR ALL
TO authenticated
USING (
  is_user_active(auth.uid())
  AND (
    processo_id IS NULL
    OR can_access_processo(auth.uid(), processo_id)
    OR responsavel_id = auth.uid()
    OR criado_por = auth.uid()
  )
)
WITH CHECK (
  is_user_active(auth.uid())
  AND (
    processo_id IS NULL
    OR can_access_processo(auth.uid(), processo_id)
    OR responsavel_id = auth.uid()
    OR criado_por = auth.uid()
  )
);