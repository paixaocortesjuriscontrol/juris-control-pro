DROP POLICY IF EXISTS "Users can update own processos" ON public.processos;
DROP POLICY IF EXISTS "processos_update_scoped" ON public.processos;

CREATE POLICY "processos_update_any_active_user"
ON public.processos
FOR UPDATE
TO authenticated
USING (is_user_active(auth.uid()))
WITH CHECK (is_user_active(auth.uid()));