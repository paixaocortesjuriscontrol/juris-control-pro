CREATE POLICY "Participantes atualizam tarefa" ON public.tarefas FOR UPDATE TO authenticated
USING (public.is_user_active(auth.uid()) AND public.sou_participante_tarefa(id))
WITH CHECK (public.is_user_active(auth.uid()) AND public.sou_participante_tarefa(id));
CREATE POLICY "Envolvidos atualizam audiencia" ON public.audiencias_detectadas FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.audiencia_envolvidos v WHERE v.audiencia_id = audiencias_detectadas.id AND v.usuario_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.audiencia_envolvidos v WHERE v.audiencia_id = audiencias_detectadas.id AND v.usuario_id = auth.uid()));