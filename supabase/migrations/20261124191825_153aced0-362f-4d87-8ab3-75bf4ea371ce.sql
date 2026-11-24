CREATE POLICY "Membros veem tarefas da coordenacao com visao escritorio" ON public.tarefas
FOR SELECT TO authenticated
USING (
  coordenacao_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.membros_coordenacao m
    JOIN public.coordenacoes c ON c.id = m.coordenacao_id
    WHERE m.coordenacao_id = tarefas.coordenacao_id
      AND m.usuario_id = (SELECT auth.uid())
      AND c.escritorio_visao_completa = true
  )
);
CREATE POLICY "Membros veem parcelas da coordenacao com visao escritorio" ON public.parcelas_evento
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.eventos_agenda e
    JOIN public.membros_coordenacao m ON m.coordenacao_id = e.coordenacao_id
    JOIN public.coordenacoes c ON c.id = e.coordenacao_id
    WHERE e.id = parcelas_evento.evento_id
      AND m.usuario_id = (SELECT auth.uid())
      AND c.escritorio_visao_completa = true
  )
);