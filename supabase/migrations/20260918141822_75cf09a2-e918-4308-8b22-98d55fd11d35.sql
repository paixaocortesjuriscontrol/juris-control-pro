CREATE TABLE IF NOT EXISTS public.alertas_dejt_fonte_estado (
  tribunal text PRIMARY KEY,
  estado text NOT NULL,
  edicao date,
  atraso_dias_uteis integer,
  notificado_em timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.alertas_dejt_fonte_estado TO authenticated;
GRANT ALL ON public.alertas_dejt_fonte_estado TO service_role;

ALTER TABLE public.alertas_dejt_fonte_estado ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem ver estado da fonte DEJT"
ON public.alertas_dejt_fonte_estado
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
