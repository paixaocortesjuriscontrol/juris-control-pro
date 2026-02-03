CREATE TABLE IF NOT EXISTS public.djen_diario_index_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data_ymd date NOT NULL,
  status text NOT NULL DEFAULT 'pendente',
  requested_by uuid DEFAULT auth.uid(),
  requested_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  finished_at timestamptz,
  erro_mensagem text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT djen_diario_index_requests_status_check
    CHECK (status IN ('pendente','em_andamento','concluido','erro','cancelado'))
);

CREATE INDEX IF NOT EXISTS idx_djen_diario_index_requests_status
  ON public.djen_diario_index_requests (status);

CREATE INDEX IF NOT EXISTS idx_djen_diario_index_requests_data
  ON public.djen_diario_index_requests (data_ymd);

CREATE INDEX IF NOT EXISTS idx_djen_diario_index_requests_requested_at
  ON public.djen_diario_index_requests (requested_at);

-- RLS
ALTER TABLE public.djen_diario_index_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários autenticados podem ver solicitacoes de indexacao"
ON public.djen_diario_index_requests FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Usuários autenticados podem criar solicitacoes de indexacao"
ON public.djen_diario_index_requests FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- Trigger para updated_at
CREATE TRIGGER update_djen_diario_index_requests_updated_at
BEFORE UPDATE ON public.djen_diario_index_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
