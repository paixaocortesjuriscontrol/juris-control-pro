CREATE TABLE public.responsaveis_fixos_tipo_tarefa (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  coordenacao_id UUID NOT NULL REFERENCES public.coordenacoes(id) ON DELETE CASCADE,
  tipo_tarefa TEXT NOT NULL,
  responsaveis UUID[] NOT NULL DEFAULT '{}',
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (coordenacao_id, tipo_tarefa)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.responsaveis_fixos_tipo_tarefa TO authenticated;
GRANT ALL ON public.responsaveis_fixos_tipo_tarefa TO service_role;

ALTER TABLE public.responsaveis_fixos_tipo_tarefa ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rftt_select_auth" ON public.responsaveis_fixos_tipo_tarefa
FOR SELECT TO authenticated USING (true);

CREATE POLICY "rftt_manage" ON public.responsaveis_fixos_tipo_tarefa
FOR ALL TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR EXISTS (SELECT 1 FROM public.coordenacoes c WHERE c.id = coordenacao_id AND c.coordenador_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.membros_coordenacao m WHERE m.coordenacao_id = responsaveis_fixos_tipo_tarefa.coordenacao_id AND m.usuario_id = auth.uid())
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR EXISTS (SELECT 1 FROM public.coordenacoes c WHERE c.id = coordenacao_id AND c.coordenador_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.membros_coordenacao m WHERE m.coordenacao_id = responsaveis_fixos_tipo_tarefa.coordenacao_id AND m.usuario_id = auth.uid())
);

CREATE TRIGGER update_rftt_updated_at BEFORE UPDATE ON public.responsaveis_fixos_tipo_tarefa
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();