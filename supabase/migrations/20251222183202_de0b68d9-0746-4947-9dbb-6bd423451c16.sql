-- Allow all authenticated (active) users to see global monitoring execution timestamps
-- while keeping coordination-specific configs restricted.

-- Replace the restrictive SELECT policy
DROP POLICY IF EXISTS "Usuários podem ver configurações da sua coordenação" ON public.configuracoes_monitoramento;

CREATE POLICY "Usuários podem ver configurações de monitoramento"
ON public.configuracoes_monitoramento
FOR SELECT
USING (
  is_user_active(auth.uid())
  AND (
    coordenacao_id IS NULL
    OR (
      is_admin_or_coordenador(auth.uid())
      AND (
        coordenacao_id IN (
          SELECT mc.coordenacao_id
          FROM public.membros_coordenacao mc
          WHERE mc.usuario_id = auth.uid()
        )
        OR has_role(auth.uid(), 'admin'::app_role)
      )
    )
  )
);
