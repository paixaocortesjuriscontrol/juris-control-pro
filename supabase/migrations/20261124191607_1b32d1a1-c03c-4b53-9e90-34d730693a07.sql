CREATE POLICY "Membros veem eventos da coordenacao com visao escritorio" ON public.eventos_agenda
FOR SELECT TO authenticated
USING (
  coordenacao_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.membros_coordenacao m
    JOIN public.coordenacoes c ON c.id = m.coordenacao_id
    WHERE m.coordenacao_id = eventos_agenda.coordenacao_id
      AND m.usuario_id = (SELECT auth.uid())
      AND c.escritorio_visao_completa = true
  )
);