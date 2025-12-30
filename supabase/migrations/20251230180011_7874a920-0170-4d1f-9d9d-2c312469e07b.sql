-- Ajustar RLS para permitir que usuários vejam/atualizem audiências criadas manualmente por eles

-- SELECT
DROP POLICY IF EXISTS "Usuários podem ver audiências acessíveis" ON public.audiencias_detectadas;
CREATE POLICY "Usuários podem ver audiências acessíveis"
ON public.audiencias_detectadas
FOR SELECT
USING (
  (origem = 'manual' AND criado_por = auth.uid())
  OR (
    monitoramento_id IN (
      SELECT monitoramentos_djen.id
      FROM monitoramentos_djen
      WHERE (
        monitoramentos_djen.criado_por = auth.uid()
        OR is_admin_or_coordenador(auth.uid())
        OR monitoramentos_djen.coordenacao_id IN (
          SELECT membros_coordenacao.coordenacao_id
          FROM membros_coordenacao
          WHERE membros_coordenacao.usuario_id = auth.uid()
        )
      )
    )
  )
);

-- UPDATE
DROP POLICY IF EXISTS "Usuários podem atualizar audiências acessíveis" ON public.audiencias_detectadas;
CREATE POLICY "Usuários podem atualizar audiências acessíveis"
ON public.audiencias_detectadas
FOR UPDATE
USING (
  (origem = 'manual' AND criado_por = auth.uid())
  OR (
    monitoramento_id IN (
      SELECT monitoramentos_djen.id
      FROM monitoramentos_djen
      WHERE (
        monitoramentos_djen.criado_por = auth.uid()
        OR is_admin_or_coordenador(auth.uid())
        OR monitoramentos_djen.coordenacao_id IN (
          SELECT membros_coordenacao.coordenacao_id
          FROM membros_coordenacao
          WHERE membros_coordenacao.usuario_id = auth.uid()
        )
      )
    )
  )
);
