CREATE POLICY "Coordenador da coordenacao edita eventos" ON public.eventos_agenda FOR UPDATE TO authenticated
USING (coordenacao_id IS NOT NULL AND public._pode_gerir_coordenacao(coordenacao_id))
WITH CHECK (coordenacao_id IS NOT NULL AND public._pode_gerir_coordenacao(coordenacao_id));