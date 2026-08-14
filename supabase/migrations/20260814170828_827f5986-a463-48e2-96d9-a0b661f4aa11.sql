CREATE TABLE public.config_acompanhamento_especial (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  coordenacao_id uuid NOT NULL REFERENCES public.coordenacoes(id) ON DELETE CASCADE,
  dias_janela_aviso integer NOT NULL DEFAULT 7,
  notificar_retroativos boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (coordenacao_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.config_acompanhamento_especial TO authenticated;
GRANT ALL ON public.config_acompanhamento_especial TO service_role;

ALTER TABLE public.config_acompanhamento_especial ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cae_select_auth" ON public.config_acompanhamento_especial
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "cae_manage_admin_coord" ON public.config_acompanhamento_especial
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'coordenador') OR public.has_role(auth.uid(), 'assistente_coordenador'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'coordenador') OR public.has_role(auth.uid(), 'assistente_coordenador'));

CREATE TRIGGER trg_cae_updated_at
  BEFORE UPDATE ON public.config_acompanhamento_especial
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.acompanhamento_especial_eventos
  ADD COLUMN IF NOT EXISTS retroativo boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_aee_retroativo ON public.acompanhamento_especial_eventos (retroativo, lido_em);