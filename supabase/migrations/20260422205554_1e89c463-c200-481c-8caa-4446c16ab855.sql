-- Atualiza RLS de audiencias_detectadas para incluir acesso via coordenacao_id
-- Atualmente, audiências sem monitoramento_id e não-manuais ficam invisíveis,
-- mesmo quando o usuário é membro da coordenação dona da audiência.

DROP POLICY IF EXISTS "Usuários podem ver audiências acessíveis" ON public.audiencias_detectadas;

CREATE POLICY "Usuários podem ver audiências acessíveis"
ON public.audiencias_detectadas
FOR SELECT
USING (
  -- Audiência manual criada pelo próprio usuário
  ((origem = 'manual') AND (criado_por = auth.uid()))
  -- OU acessível via monitoramento DJEN
  OR (monitoramento_id IN (
    SELECT m.id FROM public.monitoramentos_djen m
    WHERE m.criado_por = auth.uid()
       OR public.is_admin_or_coordenador(auth.uid())
       OR m.coordenacao_id IN (
         SELECT mc.coordenacao_id FROM public.membros_coordenacao mc
         WHERE mc.usuario_id = auth.uid()
       )
  ))
  -- OU acessível via coordenação da audiência (admin/coordenador ou membro da coordenação)
  OR (coordenacao_id IS NOT NULL AND (
    public.is_admin_or_coordenador(auth.uid())
    OR coordenacao_id IN (
      SELECT mc.coordenacao_id FROM public.membros_coordenacao mc
      WHERE mc.usuario_id = auth.uid()
    )
  ))
);