-- Tabela para jobs de backfill
CREATE TABLE public.backfill_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  started_at timestamp with time zone,
  completed_at timestamp with time zone,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'cancelled', 'failed')),
  criado_por uuid NOT NULL,
  data_inicio date NOT NULL,
  data_fim date NOT NULL,
  monitoramento_id uuid,
  progresso jsonb DEFAULT '{"processados": 0, "total": 0, "novas": 0, "descartadas": 0, "duplicadas": 0, "erros": 0}'::jsonb,
  erro text,
  logs text[] DEFAULT '{}'::text[]
);

-- Trigger para updated_at
CREATE TRIGGER update_backfill_jobs_updated_at
  BEFORE UPDATE ON public.backfill_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- RLS
ALTER TABLE public.backfill_jobs ENABLE ROW LEVEL SECURITY;

-- Políticas
CREATE POLICY "Users can view own backfill jobs"
  ON public.backfill_jobs FOR SELECT
  USING (criado_por = auth.uid() OR is_admin_or_coordenador(auth.uid()));

CREATE POLICY "Users can create backfill jobs"
  ON public.backfill_jobs FOR INSERT
  WITH CHECK (criado_por = auth.uid());

CREATE POLICY "Users can update own backfill jobs"
  ON public.backfill_jobs FOR UPDATE
  USING (criado_por = auth.uid() OR is_admin_or_coordenador(auth.uid()));

CREATE POLICY "Admins can delete backfill jobs"
  ON public.backfill_jobs FOR DELETE
  USING (is_admin_or_coordenador(auth.uid()));