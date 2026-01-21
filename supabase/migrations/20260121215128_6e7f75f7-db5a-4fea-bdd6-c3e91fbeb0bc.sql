-- Habilitar RLS na tabela de backup
ALTER TABLE public.tarefas_duplicadas_backup ENABLE ROW LEVEL SECURITY;

-- Apenas admins podem acessar (via service role nas edge functions)
CREATE POLICY "Service role only"
  ON public.tarefas_duplicadas_backup
  FOR ALL
  USING (false)
  WITH CHECK (false);