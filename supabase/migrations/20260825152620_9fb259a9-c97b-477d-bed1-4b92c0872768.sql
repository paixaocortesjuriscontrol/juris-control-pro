DROP POLICY IF EXISTS "Authenticated users can insert processos" ON public.processos;
CREATE POLICY "processos_insert_authenticated"
ON public.processos FOR INSERT TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "processos_update_any_active_user" ON public.processos;
CREATE POLICY "processos_update_authenticated"
ON public.processos FOR UPDATE TO authenticated
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.processos TO authenticated;