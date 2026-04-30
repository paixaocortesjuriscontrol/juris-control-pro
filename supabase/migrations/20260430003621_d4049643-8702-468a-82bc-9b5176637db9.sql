
CREATE TABLE IF NOT EXISTS public.judit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  processo_numero text NOT NULL,
  tribunal text,
  raw_response jsonb,
  request_payload jsonb,
  status text NOT NULL DEFAULT 'sucesso',
  error_message text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_judit_logs_processo ON public.judit_logs (processo_numero, created_at DESC);

ALTER TABLE public.judit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view judit_logs"
  ON public.judit_logs FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated can insert judit_logs"
  ON public.judit_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);
