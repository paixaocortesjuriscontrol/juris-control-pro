
ALTER TABLE public.auditoria_tarefas
  ADD COLUMN IF NOT EXISTS tipo_item TEXT,
  ADD COLUMN IF NOT EXISTS coordenacao_id UUID;

CREATE INDEX IF NOT EXISTS idx_auditoria_tarefas_tipo_item ON public.auditoria_tarefas(tipo_item);
CREATE INDEX IF NOT EXISTS idx_auditoria_tarefas_coordenacao ON public.auditoria_tarefas(coordenacao_id);

-- Política para coordenadores verem auditoria das coordenações onde são coordenador/membro
DROP POLICY IF EXISTS "Coordenadores podem ver auditoria da coordenacao" ON public.auditoria_tarefas;
CREATE POLICY "Coordenadores podem ver auditoria da coordenacao"
ON public.auditoria_tarefas
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'coordenador')
  AND coordenacao_id IS NOT NULL
  AND (
    EXISTS (SELECT 1 FROM public.coordenacoes c WHERE c.id = auditoria_tarefas.coordenacao_id AND c.coordenador_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.membros_coordenacao m WHERE m.coordenacao_id = auditoria_tarefas.coordenacao_id AND m.usuario_id = auth.uid())
  )
);
