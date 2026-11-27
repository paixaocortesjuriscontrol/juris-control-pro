CREATE INDEX IF NOT EXISTS idx_judit_logs_created_id ON public.judit_logs (created_at DESC, id DESC);
DROP POLICY IF EXISTS "Authenticated can view judit_logs" ON public.judit_logs;
CREATE POLICY "Authenticated can view judit_logs" ON public.judit_logs FOR SELECT TO authenticated
USING (created_by = (select auth.uid()) OR (select public.is_admin_or_coordenador((select auth.uid()))));