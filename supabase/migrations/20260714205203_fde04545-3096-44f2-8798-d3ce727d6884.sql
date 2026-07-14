
CREATE TABLE IF NOT EXISTS public.modelos_titulo_coordenacao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coordenacao_id UUID NOT NULL,
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('tarefa','prazo','audiencia','evento','parcela')),
  titulo TEXT NOT NULL,
  descricao TEXT,
  prioridade TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  criado_por UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_modelos_titulo_coord ON public.modelos_titulo_coordenacao (coordenacao_id, tipo) WHERE ativo = true;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.modelos_titulo_coordenacao TO authenticated;
GRANT ALL ON public.modelos_titulo_coordenacao TO service_role;

ALTER TABLE public.modelos_titulo_coordenacao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "todos_leem_modelos" ON public.modelos_titulo_coordenacao
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "admin_coord_gerenciam_modelos" ON public.modelos_titulo_coordenacao
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'coordenador'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'coordenador'));

CREATE TRIGGER trg_modelos_titulo_updated
  BEFORE UPDATE ON public.modelos_titulo_coordenacao
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
