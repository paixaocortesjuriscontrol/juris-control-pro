DROP POLICY IF EXISTS clientes_update_admin ON public.clientes;

CREATE POLICY clientes_update_admin
ON public.clientes
FOR UPDATE
TO authenticated
USING (
  is_admin_or_coordenador(auth.uid())
  OR (
    is_user_active(auth.uid())
    AND id IN (
      SELECT p.cliente_id FROM public.processos p
      WHERE p.cliente_id IS NOT NULL
        AND (
          p.advogado_responsavel_id = auth.uid()
          OR p.coordenacao_id IN (
            SELECT mc.coordenacao_id FROM public.membros_coordenacao mc
            WHERE mc.usuario_id = auth.uid()
          )
        )
    )
  )
)
WITH CHECK (
  is_admin_or_coordenador(auth.uid())
  OR (
    is_user_active(auth.uid())
    AND id IN (
      SELECT p.cliente_id FROM public.processos p
      WHERE p.cliente_id IS NOT NULL
        AND (
          p.advogado_responsavel_id = auth.uid()
          OR p.coordenacao_id IN (
            SELECT mc.coordenacao_id FROM public.membros_coordenacao mc
            WHERE mc.usuario_id = auth.uid()
          )
        )
    )
  )
);

DROP POLICY IF EXISTS clientes_insert_admin ON public.clientes;

CREATE POLICY clientes_insert_admin
ON public.clientes
FOR INSERT
TO authenticated
WITH CHECK (
  is_admin_or_coordenador(auth.uid())
  OR (
    is_user_active(auth.uid())
    AND (
      has_role(auth.uid(), 'advogado'::app_role)
      OR has_role(auth.uid(), 'advogado_temporario'::app_role)
      OR has_role(auth.uid(), 'assistente_coordenador'::app_role)
    )
  )
);