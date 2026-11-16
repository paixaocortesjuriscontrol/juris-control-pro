CREATE POLICY "Controladoria remaneja eventos acessiveis" ON public.eventos_agenda FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(),'controladoria') AND public.can_access_evento(auth.uid(), id))
WITH CHECK (public.has_role(auth.uid(),'controladoria') AND public.can_access_evento(auth.uid(), id));