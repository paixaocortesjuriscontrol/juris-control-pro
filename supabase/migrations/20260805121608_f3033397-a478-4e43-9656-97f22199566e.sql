CREATE TABLE public.alertas_diferenca_execucoes_djen (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  execucao_id uuid NOT NULL,
  fonte text NOT NULL DEFAULT 'servidor',
  coordenacao_id uuid,
  diferenca integer NOT NULL DEFAULT 0,
  total_anterior integer NOT NULL DEFAULT 0,
  total_atual integer NOT NULL DEFAULT 0,
  destinatarios integer NOT NULL DEFAULT 0,
  dia_ymd date,
  enviado_em timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX alertas_dif_exec_djen_unq
  ON public.alertas_diferenca_execucoes_djen (execucao_id, COALESCE(coordenacao_id, '00000000-0000-0000-0000-000000000000'::uuid));

CREATE INDEX alertas_dif_exec_djen_dia_idx
  ON public.alertas_diferenca_execucoes_djen (dia_ymd);

GRANT SELECT ON public.alertas_diferenca_execucoes_djen TO authenticated;
GRANT ALL ON public.alertas_diferenca_execucoes_djen TO service_role;

ALTER TABLE public.alertas_diferenca_execucoes_djen ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem ver alertas de diferenca DJEN"
ON public.alertas_diferenca_execucoes_djen
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));