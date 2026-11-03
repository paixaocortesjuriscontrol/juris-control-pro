ALTER TABLE public.workflows ADD COLUMN IF NOT EXISTS arquivado_em timestamptz, ADD COLUMN IF NOT EXISTS arquivado_por uuid;

CREATE OR REPLACE FUNCTION public.pode_arquivar_workflow(_workflow_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT has_role(auth.uid(),'admin') OR EXISTS (
    SELECT 1 FROM workflows w WHERE w.id = _workflow_id AND (
      EXISTS (SELECT 1 FROM coordenacoes c WHERE c.id = w.coordenacao_id AND c.coordenador_id = auth.uid())
      OR EXISTS (SELECT 1 FROM membros_coordenacao m WHERE m.coordenacao_id = w.coordenacao_id
                 AND m.usuario_id = auth.uid() AND lower(m.cargo) = 'coordenador')))
$$;

CREATE OR REPLACE FUNCTION public.arquivar_workflow(_workflow_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n int;
BEGIN
  IF NOT pode_arquivar_workflow(_workflow_id) THEN
    RAISE EXCEPTION 'Somente coordenadores da coordenação podem excluir este workflow';
  END IF;
  SELECT count(*) INTO n FROM workflow_execucoes WHERE workflow_id = _workflow_id AND status = 'em_andamento';
  IF n > 0 THEN
    RAISE EXCEPTION 'Workflow em uso: % execução(ões) em andamento. Conclua-as antes de excluir.', n;
  END IF;
  UPDATE workflows SET arquivado_em = now(), arquivado_por = auth.uid(), ativo = false WHERE id = _workflow_id;
END $$;

CREATE OR REPLACE FUNCTION public.restaurar_workflow(_workflow_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT pode_arquivar_workflow(_workflow_id) THEN
    RAISE EXCEPTION 'Somente coordenadores da coordenação podem restaurar este workflow';
  END IF;
  UPDATE workflows SET arquivado_em = NULL, arquivado_por = NULL WHERE id = _workflow_id;
END $$;

REVOKE ALL ON FUNCTION public.arquivar_workflow(uuid), public.restaurar_workflow(uuid), public.pode_arquivar_workflow(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.arquivar_workflow(uuid), public.restaurar_workflow(uuid), public.pode_arquivar_workflow(uuid) TO authenticated;

DROP POLICY IF EXISTS "Workflows gerenciáveis pela coordenação" ON public.workflows;
CREATE POLICY "Workflows gerenciáveis pela coordenação" ON public.workflows FOR ALL TO authenticated
USING (has_role(auth.uid(),'admin')
  OR EXISTS (SELECT 1 FROM coordenacoes c WHERE c.id = workflows.coordenacao_id AND c.coordenador_id = auth.uid())
  OR (has_role(auth.uid(),'assistente_coordenador') AND EXISTS (SELECT 1 FROM membros_coordenacao m WHERE m.coordenacao_id = workflows.coordenacao_id AND m.usuario_id = auth.uid())))
WITH CHECK (has_role(auth.uid(),'admin')
  OR EXISTS (SELECT 1 FROM coordenacoes c WHERE c.id = workflows.coordenacao_id AND c.coordenador_id = auth.uid())
  OR (has_role(auth.uid(),'assistente_coordenador') AND EXISTS (SELECT 1 FROM membros_coordenacao m WHERE m.coordenacao_id = workflows.coordenacao_id AND m.usuario_id = auth.uid())));