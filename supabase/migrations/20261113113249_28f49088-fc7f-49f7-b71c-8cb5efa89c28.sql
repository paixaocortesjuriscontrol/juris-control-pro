CREATE TABLE public.permissoes_menu_coordenacao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coordenacao_id uuid NOT NULL REFERENCES public.coordenacoes(id) ON DELETE CASCADE,
  cargo text,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  menu_path text NOT NULL,
  permitido boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pmc_alvo CHECK ((cargo IS NULL) <> (user_id IS NULL))
);
CREATE UNIQUE INDEX pmc_cargo_uq ON public.permissoes_menu_coordenacao(coordenacao_id, cargo, menu_path) WHERE cargo IS NOT NULL;
CREATE UNIQUE INDEX pmc_user_uq ON public.permissoes_menu_coordenacao(coordenacao_id, user_id, menu_path) WHERE user_id IS NOT NULL;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.permissoes_menu_coordenacao TO authenticated;
GRANT ALL ON public.permissoes_menu_coordenacao TO service_role;
ALTER TABLE public.permissoes_menu_coordenacao ENABLE ROW LEVEL SECURITY;
CREATE POLICY pmc_select ON public.permissoes_menu_coordenacao FOR SELECT TO authenticated
  USING (public._pode_gerir_coordenacao(coordenacao_id) OR EXISTS (
    SELECT 1 FROM public.membros_coordenacao m WHERE m.coordenacao_id = permissoes_menu_coordenacao.coordenacao_id AND m.usuario_id = auth.uid()));
CREATE POLICY pmc_write ON public.permissoes_menu_coordenacao FOR ALL TO authenticated
  USING (public._pode_gerir_coordenacao(coordenacao_id))
  WITH CHECK (public._pode_gerir_coordenacao(coordenacao_id));
CREATE TRIGGER pmc_updated_at BEFORE UPDATE ON public.permissoes_menu_coordenacao
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();