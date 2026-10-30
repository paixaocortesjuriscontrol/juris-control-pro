CREATE TABLE public.assuntos_coordenacao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coordenacao_id uuid NOT NULL REFERENCES public.coordenacoes(id) ON DELETE CASCADE,
  nome text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX assuntos_coordenacao_unq ON public.assuntos_coordenacao (coordenacao_id, upper(trim(nome)));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assuntos_coordenacao TO authenticated;
GRANT ALL ON public.assuntos_coordenacao TO service_role;
ALTER TABLE public.assuntos_coordenacao ENABLE ROW LEVEL SECURITY;
CREATE POLICY todos_leem_assuntos ON public.assuntos_coordenacao FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY gerenciam_assuntos_da_coordenacao ON public.assuntos_coordenacao FOR ALL TO authenticated
USING (has_role(auth.uid(),'admin') OR ((has_role(auth.uid(),'coordenador') OR has_role(auth.uid(),'assistente_coordenador')) AND EXISTS (SELECT 1 FROM membros_coordenacao mc WHERE mc.usuario_id=auth.uid() AND mc.coordenacao_id=assuntos_coordenacao.coordenacao_id)))
WITH CHECK (has_role(auth.uid(),'admin') OR ((has_role(auth.uid(),'coordenador') OR has_role(auth.uid(),'assistente_coordenador')) AND EXISTS (SELECT 1 FROM membros_coordenacao mc WHERE mc.usuario_id=auth.uid() AND mc.coordenacao_id=assuntos_coordenacao.coordenacao_id)));
CREATE TRIGGER trg_assuntos_coordenacao_updated BEFORE UPDATE ON public.assuntos_coordenacao FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();