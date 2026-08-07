DROP POLICY IF EXISTS processos_select_scoped ON public.processos;

CREATE POLICY processos_select_scoped ON public.processos
FOR SELECT
USING (
  (SELECT public.has_role(auth.uid(), 'admin'::app_role))
  OR advogado_responsavel_id = (SELECT auth.uid())
  OR coordenacao_id IN (
    SELECT mc.coordenacao_id FROM public.membros_coordenacao mc
    WHERE mc.usuario_id = (SELECT auth.uid())
  )
  OR coordenacao_id IN (
    SELECT c.id FROM public.coordenacoes c
    WHERE c.coordenador_id = (SELECT auth.uid())
  )
  OR EXISTS (
    SELECT 1 FROM public.processos_responsaveis pr
    WHERE pr.processo_id = processos.id
      AND pr.usuario_id = (SELECT auth.uid())
      AND pr.ativo = true
  )
  OR cliente_id IN (
    SELECT cu.cliente_id FROM public.clientes_usuarios cu
    WHERE cu.user_id = (SELECT auth.uid()) AND cu.ativo = true
  )
);