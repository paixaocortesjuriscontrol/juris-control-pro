CREATE TABLE public.workflow_etapa_atividades (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  etapa_id UUID NOT NULL REFERENCES public.workflow_etapas(id) ON DELETE CASCADE,
  ordem INTEGER NOT NULL DEFAULT 1,
  titulo TEXT NOT NULL,
  responsavel_id UUID NULL,
  observacao TEXT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_workflow_etapa_atividades_etapa ON public.workflow_etapa_atividades(etapa_id, ordem);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.workflow_etapa_atividades TO authenticated;
GRANT ALL ON public.workflow_etapa_atividades TO service_role;

ALTER TABLE public.workflow_etapa_atividades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Atividades de etapa acessíveis pela coordenação"
ON public.workflow_etapa_atividades
FOR SELECT
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.workflow_etapas we
  JOIN public.workflows w ON w.id = we.workflow_id
  WHERE we.id = workflow_etapa_atividades.etapa_id
    AND (public.has_role(auth.uid(), 'admin'::app_role) OR w.coordenacao_id IN (
      SELECT mc.coordenacao_id FROM public.membros_coordenacao mc WHERE mc.usuario_id = auth.uid()
      UNION
      SELECT c.id FROM public.coordenacoes c WHERE c.coordenador_id = auth.uid()
    ))
));

CREATE POLICY "Atividades de etapa gerenciáveis pela coordenação"
ON public.workflow_etapa_atividades
FOR ALL
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.workflow_etapas we
  JOIN public.workflows w ON w.id = we.workflow_id
  WHERE we.id = workflow_etapa_atividades.etapa_id
    AND (public.has_role(auth.uid(), 'admin'::app_role) OR w.coordenacao_id IN (
      SELECT mc.coordenacao_id FROM public.membros_coordenacao mc WHERE mc.usuario_id = auth.uid()
      UNION
      SELECT c.id FROM public.coordenacoes c WHERE c.coordenador_id = auth.uid()
    ))
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.workflow_etapas we
  JOIN public.workflows w ON w.id = we.workflow_id
  WHERE we.id = workflow_etapa_atividades.etapa_id
    AND (public.has_role(auth.uid(), 'admin'::app_role) OR w.coordenacao_id IN (
      SELECT mc.coordenacao_id FROM public.membros_coordenacao mc WHERE mc.usuario_id = auth.uid()
      UNION
      SELECT c.id FROM public.coordenacoes c WHERE c.coordenador_id = auth.uid()
    ))
));

CREATE TRIGGER update_workflow_etapa_atividades_updated_at
BEFORE UPDATE ON public.workflow_etapa_atividades
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();