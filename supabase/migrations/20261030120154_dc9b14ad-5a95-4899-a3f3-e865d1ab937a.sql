DROP POLICY IF EXISTS admin_coord_gerenciam_modelos ON public.modelos_titulo_coordenacao;
CREATE POLICY gerenciam_modelos_da_coordenacao ON public.modelos_titulo_coordenacao
FOR ALL TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR ((has_role(auth.uid(), 'coordenador'::app_role) OR has_role(auth.uid(), 'assistente_coordenador'::app_role))
      AND EXISTS (SELECT 1 FROM public.membros_coordenacao mc WHERE mc.usuario_id = auth.uid() AND mc.coordenacao_id = modelos_titulo_coordenacao.coordenacao_id))
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR ((has_role(auth.uid(), 'coordenador'::app_role) OR has_role(auth.uid(), 'assistente_coordenador'::app_role))
      AND EXISTS (SELECT 1 FROM public.membros_coordenacao mc WHERE mc.usuario_id = auth.uid() AND mc.coordenacao_id = modelos_titulo_coordenacao.coordenacao_id))
);