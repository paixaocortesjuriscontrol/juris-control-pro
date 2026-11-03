DROP POLICY IF EXISTS "Workflows gerenciáveis pela coordenação" ON public.workflows;
CREATE POLICY "Workflows gerenciáveis pela coordenação" ON public.workflows FOR ALL TO authenticated
USING (has_role(auth.uid(),'admin')
  OR EXISTS (SELECT 1 FROM coordenacoes c WHERE c.id = workflows.coordenacao_id AND c.coordenador_id = auth.uid())
  OR EXISTS (SELECT 1 FROM membros_coordenacao m WHERE m.coordenacao_id = workflows.coordenacao_id AND m.usuario_id = auth.uid()
     AND (lower(m.cargo) = 'coordenador' OR has_role(auth.uid(),'assistente_coordenador'))))
WITH CHECK (has_role(auth.uid(),'admin')
  OR EXISTS (SELECT 1 FROM coordenacoes c WHERE c.id = workflows.coordenacao_id AND c.coordenador_id = auth.uid())
  OR EXISTS (SELECT 1 FROM membros_coordenacao m WHERE m.coordenacao_id = workflows.coordenacao_id AND m.usuario_id = auth.uid()
     AND (lower(m.cargo) = 'coordenador' OR has_role(auth.uid(),'assistente_coordenador'))));