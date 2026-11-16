DROP POLICY IF EXISTS "Controladoria remaneja eventos acessiveis" ON public.eventos_agenda;
CREATE POLICY "Controladoria remaneja eventos acessiveis" ON public.eventos_agenda FOR UPDATE TO authenticated
USING ((public.has_role(auth.uid(),'controladoria') AND public.can_access_evento(auth.uid(), id))
  OR (coordenacao_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.membros_coordenacao m WHERE m.coordenacao_id = eventos_agenda.coordenacao_id AND m.usuario_id = auth.uid() AND lower(m.cargo) = 'controladoria')))
WITH CHECK ((public.has_role(auth.uid(),'controladoria') AND public.can_access_evento(auth.uid(), id))
  OR (coordenacao_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.membros_coordenacao m WHERE m.coordenacao_id = eventos_agenda.coordenacao_id AND m.usuario_id = auth.uid() AND lower(m.cargo) = 'controladoria')));
DROP POLICY IF EXISTS "Controladoria remaneja audiencias acessiveis" ON public.audiencias_detectadas;
CREATE POLICY "Controladoria remaneja audiencias acessiveis" ON public.audiencias_detectadas FOR UPDATE TO authenticated
USING ((public.has_role(auth.uid(),'controladoria') AND ((processo_id IS NOT NULL AND public.can_access_processo(auth.uid(), processo_id)) OR coordenacao_id IN (SELECT mc.coordenacao_id FROM public.membros_coordenacao mc WHERE mc.usuario_id = auth.uid())))
  OR (coordenacao_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.membros_coordenacao m WHERE m.coordenacao_id = audiencias_detectadas.coordenacao_id AND m.usuario_id = auth.uid() AND lower(m.cargo) = 'controladoria')))
WITH CHECK (public.has_role(auth.uid(),'controladoria')
  OR (coordenacao_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.membros_coordenacao m WHERE m.coordenacao_id = audiencias_detectadas.coordenacao_id AND m.usuario_id = auth.uid() AND lower(m.cargo) = 'controladoria')));