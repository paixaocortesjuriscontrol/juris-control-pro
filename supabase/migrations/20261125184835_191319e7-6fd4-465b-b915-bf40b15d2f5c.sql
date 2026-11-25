CREATE OR REPLACE FUNCTION public.sou_participante_item_do_processo(_processo_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT auth.uid() IS NOT NULL AND (
    EXISTS (SELECT 1 FROM tarefas t JOIN tarefa_responsaveis r ON r.tarefa_id=t.id WHERE t.processo_id=_processo_id AND r.usuario_id=auth.uid())
    OR EXISTS (SELECT 1 FROM tarefas t JOIN tarefa_envolvidos e ON e.tarefa_id=t.id WHERE t.processo_id=_processo_id AND e.usuario_id=auth.uid())
    OR EXISTS (SELECT 1 FROM eventos_agenda ev JOIN evento_responsaveis r ON r.evento_id=ev.id WHERE ev.processo_id=_processo_id AND r.usuario_id=auth.uid())
    OR EXISTS (SELECT 1 FROM eventos_agenda ev JOIN evento_envolvidos e ON e.evento_id=ev.id WHERE ev.processo_id=_processo_id AND e.usuario_id=auth.uid())
    OR EXISTS (SELECT 1 FROM audiencias_detectadas a JOIN audiencias_advogados r ON r.audiencia_id=a.id WHERE a.processo_id=_processo_id AND r.advogado_id=auth.uid())
    OR EXISTS (SELECT 1 FROM audiencias_detectadas a JOIN audiencia_envolvidos e ON e.audiencia_id=a.id WHERE a.processo_id=_processo_id AND e.usuario_id=auth.uid())
  )
$$;
REVOKE EXECUTE ON FUNCTION public.sou_participante_item_do_processo(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.sou_participante_item_do_processo(uuid) TO authenticated;
CREATE POLICY "Participantes de atividades veem o processo ligado" ON public.processos
  FOR SELECT TO authenticated USING (public.sou_participante_item_do_processo(id));