DROP POLICY IF EXISTS "dados_benner_select" ON public.dados_benner;
CREATE POLICY "dados_benner_select" ON public.dados_benner
  FOR SELECT TO authenticated
  USING (true);