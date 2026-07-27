CREATE TABLE public.permissoes_menu_usuario (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  menu_path text NOT NULL,
  permitido boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, menu_path)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.permissoes_menu_usuario TO authenticated;
GRANT ALL ON public.permissoes_menu_usuario TO service_role;

ALTER TABLE public.permissoes_menu_usuario ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuario le suas proprias permissoes"
ON public.permissoes_menu_usuario FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'coordenador'));

CREATE POLICY "Admin e coordenador inserem permissoes"
ON public.permissoes_menu_usuario FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'coordenador'));

CREATE POLICY "Admin e coordenador atualizam permissoes"
ON public.permissoes_menu_usuario FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'coordenador'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'coordenador'));

CREATE POLICY "Admin e coordenador removem permissoes"
ON public.permissoes_menu_usuario FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'coordenador'));

CREATE TRIGGER update_permissoes_menu_usuario_updated_at
BEFORE UPDATE ON public.permissoes_menu_usuario
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();