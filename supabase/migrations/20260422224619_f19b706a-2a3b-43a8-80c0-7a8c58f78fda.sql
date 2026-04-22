-- Aligns audiencias_detectadas UPDATE policy with the SELECT policy
-- Previously, users could view audiências by coordenação but could not update them,
-- causing silent no-op updates (status changes that didn't persist).

DROP POLICY IF EXISTS "Usuários podem atualizar audiências acessíveis" ON public.audiencias_detectadas;

CREATE POLICY "Usuários podem atualizar audiências acessíveis"
ON public.audiencias_detectadas
FOR UPDATE
USING (
  ((origem = 'manual'::text) AND (criado_por = auth.uid()))
  OR (monitoramento_id IN (
    SELECT m.id
    FROM monitoramentos_djen m
    WHERE (m.criado_por = auth.uid())
       OR is_admin_or_coordenador(auth.uid())
       OR (m.coordenacao_id IN (
         SELECT mc.coordenacao_id
         FROM membros_coordenacao mc
         WHERE mc.usuario_id = auth.uid()
       ))
  ))
  OR (
    (coordenacao_id IS NOT NULL) AND (
      is_admin_or_coordenador(auth.uid())
      OR (coordenacao_id IN (
        SELECT mc.coordenacao_id
        FROM membros_coordenacao mc
        WHERE mc.usuario_id = auth.uid()
      ))
    )
  )
);