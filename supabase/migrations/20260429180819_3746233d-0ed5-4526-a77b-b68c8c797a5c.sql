DROP POLICY IF EXISTS "Users can update own monitoramentos" ON public.monitoramentos_djen;
DROP POLICY IF EXISTS "Users can delete own monitoramentos" ON public.monitoramentos_djen;

CREATE POLICY "Users can update accessible monitoramentos"
ON public.monitoramentos_djen
FOR UPDATE
USING (
  criado_por = auth.uid()
  OR public.is_admin_or_coordenador(auth.uid())
  OR coordenacao_id IN (
    SELECT mc.coordenacao_id
    FROM public.membros_coordenacao mc
    WHERE mc.usuario_id = auth.uid()
  )
);

CREATE POLICY "Users can delete accessible monitoramentos"
ON public.monitoramentos_djen
FOR DELETE
USING (
  criado_por = auth.uid()
  OR public.is_admin_or_coordenador(auth.uid())
  OR coordenacao_id IN (
    SELECT mc.coordenacao_id
    FROM public.membros_coordenacao mc
    WHERE mc.usuario_id = auth.uid()
  )
);