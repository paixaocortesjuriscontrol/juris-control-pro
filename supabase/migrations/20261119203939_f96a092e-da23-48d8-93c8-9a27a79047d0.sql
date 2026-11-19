CREATE OR REPLACE FUNCTION public.pode_alterar_participantes(_tabela text, _item uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _u uuid := auth.uid(); _coord uuid; _criador uuid; _criado timestamptz; _t text; _fatal text; _tipo text;
BEGIN
  IF _u IS NULL OR public.is_admin_or_coordenador(_u) THEN RETURN true; END IF;
  IF _tabela = 'audiencia' THEN
    SELECT coordenacao_id, criado_por, created_at INTO _coord, _criador, _criado FROM audiencias_detectadas WHERE id=_item;
    IF NOT FOUND THEN RETURN true; END IF; _tipo := 'audiencia';
  ELSIF _tabela = 'evento' THEN
    SELECT coordenacao_id, criado_por, created_at INTO _coord, _criador, _criado FROM eventos_agenda WHERE id=_item;
    IF NOT FOUND THEN RETURN true; END IF; _tipo := 'evento';
  ELSE
    SELECT coordenacao_id, criado_por, created_at, upper(coalesce(tipo_tarefa,'')), (to_jsonb(t)->>'data_fatal')
      INTO _coord, _criador, _criado, _t, _fatal FROM tarefas t WHERE id=_item;
    IF NOT FOUND THEN RETURN true; END IF;
    _tipo := CASE WHEN _t LIKE 'AUDI%' THEN 'audiencia' WHEN _t='EVENTO' THEN 'evento'
                  WHEN _t LIKE 'PRAZO%' OR _fatal IS NOT NULL THEN 'prazo' ELSE 'tarefa' END;
  END IF;
  IF _criador = _u OR _criado > now() - interval '10 minutes' THEN RETURN true; END IF;
  RETURN public.pode_configurar_agendamento(_u, _coord, _tipo);
END $$;
GRANT EXECUTE ON FUNCTION public.pode_alterar_participantes(text, uuid) TO authenticated;

DROP POLICY IF EXISTS "Admins e coordenadores podem deletar advogados de audiências" ON public.audiencias_advogados;
CREATE POLICY "Participantes audiencia removiveis" ON public.audiencias_advogados FOR DELETE TO authenticated USING (public.pode_alterar_participantes('audiencia', audiencia_id));
DROP POLICY IF EXISTS "Usuários autenticados podem inserir advogados em audiências" ON public.audiencias_advogados;
CREATE POLICY "Participantes audiencia incluiveis" ON public.audiencias_advogados FOR INSERT TO authenticated WITH CHECK (public.pode_alterar_participantes('audiencia', audiencia_id));

DROP POLICY IF EXISTS "auth delete audiencia_envolvidos" ON public.audiencia_envolvidos;
CREATE POLICY "auth delete audiencia_envolvidos" ON public.audiencia_envolvidos FOR DELETE TO authenticated USING (public.pode_alterar_participantes('audiencia', audiencia_id));
DROP POLICY IF EXISTS "auth write audiencia_envolvidos" ON public.audiencia_envolvidos;
CREATE POLICY "auth write audiencia_envolvidos" ON public.audiencia_envolvidos FOR INSERT TO authenticated WITH CHECK (public.pode_alterar_participantes('audiencia', audiencia_id));

DROP POLICY IF EXISTS "auth delete tarefa_responsaveis" ON public.tarefa_responsaveis;
CREATE POLICY "auth delete tarefa_responsaveis" ON public.tarefa_responsaveis FOR DELETE TO authenticated USING (public.pode_alterar_participantes('tarefa', tarefa_id));
DROP POLICY IF EXISTS "auth write tarefa_responsaveis" ON public.tarefa_responsaveis;
CREATE POLICY "auth write tarefa_responsaveis" ON public.tarefa_responsaveis FOR INSERT TO authenticated WITH CHECK (public.pode_alterar_participantes('tarefa', tarefa_id));

DROP POLICY IF EXISTS "auth delete tarefa_envolvidos" ON public.tarefa_envolvidos;
CREATE POLICY "auth delete tarefa_envolvidos" ON public.tarefa_envolvidos FOR DELETE TO authenticated USING (public.pode_alterar_participantes('tarefa', tarefa_id));
DROP POLICY IF EXISTS "auth write tarefa_envolvidos" ON public.tarefa_envolvidos;
CREATE POLICY "auth write tarefa_envolvidos" ON public.tarefa_envolvidos FOR INSERT TO authenticated WITH CHECK (public.pode_alterar_participantes('tarefa', tarefa_id));

DROP POLICY IF EXISTS "auth delete evento_responsaveis" ON public.evento_responsaveis;
CREATE POLICY "auth delete evento_responsaveis" ON public.evento_responsaveis FOR DELETE TO authenticated USING (public.pode_alterar_participantes('evento', evento_id));
DROP POLICY IF EXISTS "auth write evento_responsaveis" ON public.evento_responsaveis;
CREATE POLICY "auth write evento_responsaveis" ON public.evento_responsaveis FOR INSERT TO authenticated WITH CHECK (public.pode_alterar_participantes('evento', evento_id));

DROP POLICY IF EXISTS "auth delete evento_envolvidos" ON public.evento_envolvidos;
CREATE POLICY "auth delete evento_envolvidos" ON public.evento_envolvidos FOR DELETE TO authenticated USING (public.pode_alterar_participantes('evento', evento_id));
DROP POLICY IF EXISTS "auth write evento_envolvidos" ON public.evento_envolvidos;
CREATE POLICY "auth write evento_envolvidos" ON public.evento_envolvidos FOR INSERT TO authenticated WITH CHECK (public.pode_alterar_participantes('evento', evento_id));