
ALTER TABLE public.judit_logs
  ADD COLUMN IF NOT EXISTS origem TEXT,
  ADD COLUMN IF NOT EXISTS user_email TEXT,
  ADD COLUMN IF NOT EXISTS duracao_ms INTEGER,
  ADD COLUMN IF NOT EXISTS tipo_cobranca TEXT;

CREATE INDEX IF NOT EXISTS idx_judit_logs_created_at ON public.judit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_judit_logs_created_by ON public.judit_logs (created_by);
CREATE INDEX IF NOT EXISTS idx_judit_logs_tipo_cobranca ON public.judit_logs (tipo_cobranca);
