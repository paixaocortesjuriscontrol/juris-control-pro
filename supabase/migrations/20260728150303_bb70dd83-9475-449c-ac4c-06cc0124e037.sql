
CREATE OR REPLACE FUNCTION public.can_comment_tarefa(_user_id uuid, _tarefa_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tarefas t
    WHERE t.id = _tarefa_id
      AND (
        public.is_admin_or_coordenador(_user_id)
        OR t.criado_por = _user_id
        OR t.responsavel_id = _user_id
        OR (t.processo_id IS NOT NULL AND public.can_access_processo(_user_id, t.processo_id))
        OR EXISTS (SELECT 1 FROM public.tarefa_responsaveis tr WHERE tr.tarefa_id = t.id AND tr.usuario_id = _user_id)
        OR EXISTS (SELECT 1 FROM public.tarefa_envolvidos te WHERE te.tarefa_id = t.id AND te.usuario_id = _user_id)
        OR (t.coordenacao_id IS NOT NULL AND EXISTS (
              SELECT 1 FROM public.membros_coordenacao mc
              WHERE mc.coordenacao_id = t.coordenacao_id AND mc.usuario_id = _user_id))
      )
  )
$$;

CREATE OR REPLACE FUNCTION public.can_comment_audiencia(_user_id uuid, _audiencia_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.audiencias_detectadas a
    WHERE a.id = _audiencia_id
      AND (
        public.is_admin_or_coordenador(_user_id)
        OR a.criado_por = _user_id
        OR (a.processo_id IS NOT NULL AND public.can_access_processo(_user_id, a.processo_id))
        OR EXISTS (SELECT 1 FROM public.audiencias_advogados aa WHERE aa.audiencia_id = a.id AND aa.advogado_id = _user_id)
        OR EXISTS (SELECT 1 FROM public.audiencia_envolvidos ae WHERE ae.audiencia_id = a.id AND ae.usuario_id = _user_id)
        OR (a.coordenacao_id IS NOT NULL AND EXISTS (
              SELECT 1 FROM public.membros_coordenacao mc
              WHERE mc.coordenacao_id = a.coordenacao_id AND mc.usuario_id = _user_id))
      )
  )
$$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.comentarios_tarefas TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.comentarios_audiencias TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.comentarios_eventos TO authenticated;
GRANT ALL ON public.comentarios_tarefas TO service_role;
GRANT ALL ON public.comentarios_audiencias TO service_role;
GRANT ALL ON public.comentarios_eventos TO service_role;

DROP POLICY IF EXISTS "Users can view comments on accessible tasks" ON public.comentarios_tarefas;
DROP POLICY IF EXISTS "Users can create comments on accessible tasks" ON public.comentarios_tarefas;

CREATE POLICY "Ver comentarios de tarefas acessiveis"
ON public.comentarios_tarefas FOR SELECT TO authenticated
USING (public.can_comment_tarefa(auth.uid(), tarefa_id));

CREATE POLICY "Criar comentarios em tarefas acessiveis"
ON public.comentarios_tarefas FOR INSERT TO authenticated
WITH CHECK (autor_id = auth.uid() AND public.can_comment_tarefa(auth.uid(), tarefa_id));

DROP POLICY IF EXISTS "Ver comentarios de audiencias visiveis" ON public.comentarios_audiencias;
DROP POLICY IF EXISTS "Criar comentarios audiencia como autor" ON public.comentarios_audiencias;

CREATE POLICY "Ver comentarios de audiencias acessiveis"
ON public.comentarios_audiencias FOR SELECT TO authenticated
USING (public.can_comment_audiencia(auth.uid(), audiencia_id));

CREATE POLICY "Criar comentarios em audiencias acessiveis"
ON public.comentarios_audiencias FOR INSERT TO authenticated
WITH CHECK (autor_id = auth.uid() AND public.can_comment_audiencia(auth.uid(), audiencia_id));
