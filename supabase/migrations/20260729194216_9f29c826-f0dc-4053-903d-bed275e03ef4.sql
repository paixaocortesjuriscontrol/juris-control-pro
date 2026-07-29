CREATE TABLE IF NOT EXISTS public.alertas_recebidos_leituras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  alerta_id uuid NOT NULL REFERENCES public.historico_alertas_enviados(id) ON DELETE CASCADE,
  lido_em timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, alerta_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.alertas_recebidos_leituras TO authenticated;
GRANT ALL ON public.alertas_recebidos_leituras TO service_role;

ALTER TABLE public.alertas_recebidos_leituras ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuario gerencia suas leituras de alertas"
ON public.alertas_recebidos_leituras FOR ALL TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_alertas_leituras_user ON public.alertas_recebidos_leituras(user_id);