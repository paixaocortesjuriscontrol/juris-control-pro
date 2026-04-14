
CREATE TABLE public.baixar_autos_jobs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  processo_id UUID NOT NULL REFERENCES public.processos(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'iniciado',
  etapa TEXT NOT NULL DEFAULT 'Iniciando busca...',
  documentos_total INTEGER DEFAULT 0,
  documentos_baixados INTEGER DEFAULT 0,
  documentos_existentes INTEGER DEFAULT 0,
  documentos_erro INTEGER DEFAULT 0,
  mensagem TEXT,
  erro TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.baixar_autos_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own jobs"
  ON public.baixar_autos_jobs FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Service role can manage all jobs"
  ON public.baixar_autos_jobs FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE TRIGGER update_baixar_autos_jobs_updated_at
  BEFORE UPDATE ON public.baixar_autos_jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_baixar_autos_jobs_processo ON public.baixar_autos_jobs(processo_id, created_at DESC);
