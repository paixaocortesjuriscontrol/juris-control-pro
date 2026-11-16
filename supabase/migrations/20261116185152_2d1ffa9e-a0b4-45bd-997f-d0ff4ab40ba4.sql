CREATE POLICY "Coordenador da coordenacao apaga eventos" ON public.eventos_agenda FOR DELETE TO authenticated
USING (coordenacao_id IS NOT NULL AND public._pode_gerir_coordenacao(coordenacao_id));