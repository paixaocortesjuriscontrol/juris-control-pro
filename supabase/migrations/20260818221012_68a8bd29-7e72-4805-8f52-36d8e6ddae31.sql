CREATE TABLE public.config_alerta_diferenca_djen (
  coordenacao_id UUID NOT NULL PRIMARY KEY REFERENCES public.coordenacoes(id) ON DELETE CASCADE,
  todos BOOLEAN NOT NULL DEFAULT true,
  usuarios UUID[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.config_alerta_diferenca_djen TO authenticated;
GRANT ALL ON public.config_alerta_diferenca_djen TO service_role;

ALTER TABLE public.config_alerta_diferenca_djen ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cadd_select_auth" ON public.config_alerta_diferenca_djen
FOR SELECT TO authenticated USING (true);

CREATE POLICY "cadd_manage_admin_coord" ON public.config_alerta_diferenca_djen
FOR ALL TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR EXISTS (
    SELECT 1 FROM public.coordenacoes c
    WHERE c.id = config_alerta_diferenca_djen.coordenacao_id
      AND c.coordenador_id = auth.uid()
  )
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR EXISTS (
    SELECT 1 FROM public.coordenacoes c
    WHERE c.id = config_alerta_diferenca_djen.coordenacao_id
      AND c.coordenador_id = auth.uid()
  )
);

CREATE TRIGGER trg_cadd_updated_at
BEFORE UPDATE ON public.config_alerta_diferenca_djen
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();