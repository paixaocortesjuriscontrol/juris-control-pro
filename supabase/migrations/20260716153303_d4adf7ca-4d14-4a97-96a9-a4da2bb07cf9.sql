CREATE TABLE public.ai_usage_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid,
  user_email text,
  edge_function text NOT NULL,
  origem text,
  model text NOT NULL,
  prompt_tokens integer DEFAULT 0,
  completion_tokens integer DEFAULT 0,
  total_tokens integer DEFAULT 0,
  custo_usd numeric(12,6) DEFAULT 0,
  duracao_ms integer,
  status text NOT NULL DEFAULT 'success',
  erro text,
  metadata jsonb DEFAULT '{}'::jsonb
);

GRANT SELECT ON public.ai_usage_logs TO authenticated;
GRANT ALL ON public.ai_usage_logs TO service_role;

ALTER TABLE public.ai_usage_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem ler ai_usage_logs"
ON public.ai_usage_logs
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_ai_usage_logs_created_at ON public.ai_usage_logs (created_at DESC);
CREATE INDEX idx_ai_usage_logs_user_created ON public.ai_usage_logs (user_id, created_at DESC);
CREATE INDEX idx_ai_usage_logs_fn_created ON public.ai_usage_logs (edge_function, created_at DESC);
CREATE INDEX idx_ai_usage_logs_model_created ON public.ai_usage_logs (model, created_at DESC);