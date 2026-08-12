CREATE TABLE public.permissoes_situacao_tipo_tarefa (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coordenacao_id uuid NOT NULL REFERENCES public.coordenacoes(id) ON DELETE CASCADE,
  tipo_tarefa text NOT NULL,
  situacao text NOT NULL,
  perfis text[] NOT NULL DEFAULT '{}',
  usuarios uuid[] NOT NULL DEFAULT '{}',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (coordenacao_id, tipo_tarefa, situacao)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.permissoes_situacao_tipo_tarefa TO authenticated;
GRANT ALL ON public.permissoes_situacao_tipo_tarefa TO service_role;

ALTER TABLE public.permissoes_situacao_tipo_tarefa ENABLE ROW LEVEL SECURITY;

CREATE POLICY "permissoes_situacao_select"
ON public.permissoes_situacao_tipo_tarefa
FOR SELECT TO authenticated
USING (true);

CREATE POLICY "permissoes_situacao_manage"
ON public.permissoes_situacao_tipo_tarefa
FOR ALL TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR EXISTS (
    SELECT 1 FROM public.coordenacoes c
    WHERE c.id = permissoes_situacao_tipo_tarefa.coordenacao_id
      AND c.coordenador_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.membros_coordenacao m
    WHERE m.coordenacao_id = permissoes_situacao_tipo_tarefa.coordenacao_id
      AND m.usuario_id = auth.uid()
      AND lower(coalesce(m.cargo, '')) LIKE '%coordenador%'
  )
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR EXISTS (
    SELECT 1 FROM public.coordenacoes c
    WHERE c.id = permissoes_situacao_tipo_tarefa.coordenacao_id
      AND c.coordenador_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.membros_coordenacao m
    WHERE m.coordenacao_id = permissoes_situacao_tipo_tarefa.coordenacao_id
      AND m.usuario_id = auth.uid()
      AND lower(coalesce(m.cargo, '')) LIKE '%coordenador%'
  )
);

CREATE TRIGGER trg_permissoes_situacao_updated_at
BEFORE UPDATE ON public.permissoes_situacao_tipo_tarefa
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();