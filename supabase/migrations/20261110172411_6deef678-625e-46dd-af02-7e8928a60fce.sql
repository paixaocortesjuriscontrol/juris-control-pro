CREATE OR REPLACE FUNCTION public.is_participante_tarefa(_user uuid, _tarefa uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM tarefa_responsaveis WHERE tarefa_id=_tarefa AND usuario_id=_user)
      OR EXISTS (SELECT 1 FROM tarefa_envolvidos WHERE tarefa_id=_tarefa AND usuario_id=_user)
$$;
REVOKE EXECUTE ON FUNCTION public.is_participante_tarefa(uuid, uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.is_participante_tarefa(uuid, uuid) TO authenticated;
CREATE POLICY "Responsaveis e envolvidos veem a tarefa" ON public.tarefas
FOR SELECT TO authenticated
USING (public.is_user_active(auth.uid()) AND public.is_participante_tarefa(auth.uid(), id));