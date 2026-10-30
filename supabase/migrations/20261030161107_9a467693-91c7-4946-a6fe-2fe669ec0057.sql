CREATE TABLE public.logs_tentativas_formulario (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL DEFAULT auth.uid(),
  formulario text NOT NULL,
  etapa text NOT NULL,
  detalhes jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT INSERT ON public.logs_tentativas_formulario TO authenticated;
GRANT ALL ON public.logs_tentativas_formulario TO service_role;
ALTER TABLE public.logs_tentativas_formulario ENABLE ROW LEVEL SECURITY;
CREATE POLICY "usuario grava a propria tentativa" ON public.logs_tentativas_formulario FOR INSERT TO authenticated WITH CHECK (usuario_id = auth.uid());
CREATE INDEX ON public.logs_tentativas_formulario (usuario_id, created_at DESC);