DROP POLICY "Responsaveis e envolvidos veem a tarefa" ON public.tarefas;
DROP FUNCTION public.is_participante_tarefa(uuid, uuid);
CREATE OR REPLACE FUNCTION public.sou_participante_tarefa(_tarefa uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM tarefa_responsaveis WHERE tarefa_id=_tarefa AND usuario_id=auth.uid())
      OR EXISTS (SELECT 1 FROM tarefa_envolvidos WHERE tarefa_id=_tarefa AND usuario_id=auth.uid())
$$;
REVOKE EXECUTE ON FUNCTION public.sou_participante_tarefa(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.sou_participante_tarefa(uuid) TO authenticated;
CREATE POLICY "Responsaveis e envolvidos veem a tarefa" ON public.tarefas
FOR SELECT TO authenticated
USING (public.is_user_active(auth.uid()) AND public.sou_participante_tarefa(id));