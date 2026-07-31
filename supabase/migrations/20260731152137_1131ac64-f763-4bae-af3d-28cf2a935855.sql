CREATE OR REPLACE FUNCTION public.is_membro_coordenacao(_coordenacao_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'admin')
      OR EXISTS (
        SELECT 1 FROM public.membros_coordenacao mc
        WHERE mc.coordenacao_id = _coordenacao_id
          AND mc.usuario_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM public.coordenacoes c
        WHERE c.id = _coordenacao_id
          AND c.coordenador_id = auth.uid()
      );
$$;

CREATE OR REPLACE FUNCTION public.pode_gerenciar_etiquetas(_coordenacao_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'admin')
      OR (
        (public.has_role(auth.uid(), 'coordenador') OR public.has_role(auth.uid(), 'assistente_coordenador'))
        AND public.is_membro_coordenacao(_coordenacao_id)
      );
$$;

CREATE TABLE public.etiquetas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coordenacao_id uuid NOT NULL REFERENCES public.coordenacoes(id) ON DELETE CASCADE,
  nome text NOT NULL,
  cor text NOT NULL DEFAULT '#6366f1',
  modulos text[] NOT NULL DEFAULT ARRAY['processos','itens','clientes','publicacoes']::text[],
  ativo boolean NOT NULL DEFAULT true,
  ordem integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX etiquetas_coord_nome_uniq ON public.etiquetas (coordenacao_id, lower(nome));
CREATE INDEX etiquetas_coordenacao_idx ON public.etiquetas (coordenacao_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.etiquetas TO authenticated;
GRANT ALL ON public.etiquetas TO service_role;

ALTER TABLE public.etiquetas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "etiquetas_select_membros" ON public.etiquetas
FOR SELECT TO authenticated
USING (public.is_membro_coordenacao(coordenacao_id));

CREATE POLICY "etiquetas_insert_gestores" ON public.etiquetas
FOR INSERT TO authenticated
WITH CHECK (public.pode_gerenciar_etiquetas(coordenacao_id));

CREATE POLICY "etiquetas_update_gestores" ON public.etiquetas
FOR UPDATE TO authenticated
USING (public.pode_gerenciar_etiquetas(coordenacao_id))
WITH CHECK (public.pode_gerenciar_etiquetas(coordenacao_id));

CREATE POLICY "etiquetas_delete_gestores" ON public.etiquetas
FOR DELETE TO authenticated
USING (public.pode_gerenciar_etiquetas(coordenacao_id));

CREATE TABLE public.etiquetas_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  etiqueta_id uuid NOT NULL REFERENCES public.etiquetas(id) ON DELETE CASCADE,
  entidade text NOT NULL,
  entidade_id uuid NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX etiquetas_itens_uniq ON public.etiquetas_itens (etiqueta_id, entidade, entidade_id);
CREATE INDEX etiquetas_itens_entidade_idx ON public.etiquetas_itens (entidade, entidade_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.etiquetas_itens TO authenticated;
GRANT ALL ON public.etiquetas_itens TO service_role;

ALTER TABLE public.etiquetas_itens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "etiquetas_itens_select_membros" ON public.etiquetas_itens
FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.etiquetas e
  WHERE e.id = etiqueta_id AND public.is_membro_coordenacao(e.coordenacao_id)
));

CREATE POLICY "etiquetas_itens_insert_membros" ON public.etiquetas_itens
FOR INSERT TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM public.etiquetas e
  WHERE e.id = etiqueta_id AND public.is_membro_coordenacao(e.coordenacao_id)
));

CREATE POLICY "etiquetas_itens_delete_membros" ON public.etiquetas_itens
FOR DELETE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.etiquetas e
  WHERE e.id = etiqueta_id AND public.is_membro_coordenacao(e.coordenacao_id)
));

CREATE TRIGGER etiquetas_set_updated_at
BEFORE UPDATE ON public.etiquetas
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();