CREATE TABLE public.subatividades_item (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo_item TEXT NOT NULL,
  item_id UUID NOT NULL,
  titulo TEXT NOT NULL,
  responsavel_id UUID,
  data_prevista DATE,
  situacao TEXT NOT NULL DEFAULT 'pendente',
  observacao TEXT,
  concluida_em TIMESTAMP WITH TIME ZONE,
  concluida_por UUID,
  criado_por UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_subatividades_item_lookup ON public.subatividades_item (tipo_item, item_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.subatividades_item TO authenticated;
GRANT ALL ON public.subatividades_item TO service_role;

ALTER TABLE public.subatividades_item ENABLE ROW LEVEL SECURITY;

CREATE POLICY "subatividades_select" ON public.subatividades_item
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "subatividades_insert" ON public.subatividades_item
  FOR INSERT TO authenticated WITH CHECK (criado_por = auth.uid());

CREATE POLICY "subatividades_update" ON public.subatividades_item
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "subatividades_delete" ON public.subatividades_item
  FOR DELETE TO authenticated USING (
    criado_por = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'coordenador')
    OR public.has_role(auth.uid(), 'assistente_coordenador')
  );

CREATE TRIGGER update_subatividades_item_updated_at
  BEFORE UPDATE ON public.subatividades_item
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();