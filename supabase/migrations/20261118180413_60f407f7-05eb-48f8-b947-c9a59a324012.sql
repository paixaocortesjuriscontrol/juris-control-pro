CREATE POLICY "Responsaveis e envolvidos atualizam evento" ON public.eventos_agenda FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.evento_responsaveis r WHERE r.evento_id = eventos_agenda.id AND r.usuario_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.evento_envolvidos v WHERE v.evento_id = eventos_agenda.id AND v.usuario_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.evento_responsaveis r WHERE r.evento_id = eventos_agenda.id AND r.usuario_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.evento_envolvidos v WHERE v.evento_id = eventos_agenda.id AND v.usuario_id = auth.uid()));