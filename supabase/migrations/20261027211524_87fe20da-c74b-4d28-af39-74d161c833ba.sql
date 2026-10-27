CREATE OR REPLACE FUNCTION public.is_assistente_juridico_geral(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_user_id, 'assistente_juridico_geral')
     AND NOT public.is_admin_or_coordenador(_user_id)
$$;
REVOKE EXECUTE ON FUNCTION public.is_assistente_juridico_geral(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.is_assistente_juridico_geral(uuid) TO authenticated;

-- Leitura em todas as coordenações
CREATE POLICY "Assistente geral visualiza coordenacoes" ON public.coordenacoes FOR SELECT TO authenticated USING (public.is_assistente_juridico_geral(auth.uid()));
CREATE POLICY "Assistente geral visualiza membros" ON public.membros_coordenacao FOR SELECT TO authenticated USING (public.is_assistente_juridico_geral(auth.uid()));
CREATE POLICY "Assistente geral visualiza tarefas" ON public.tarefas FOR SELECT TO authenticated USING (public.is_assistente_juridico_geral(auth.uid()));
CREATE POLICY "Assistente geral visualiza eventos" ON public.eventos_agenda FOR SELECT TO authenticated USING (public.is_assistente_juridico_geral(auth.uid()));
CREATE POLICY "Assistente geral visualiza audiencias" ON public.audiencias_detectadas FOR SELECT TO authenticated USING (public.is_assistente_juridico_geral(auth.uid()));
CREATE POLICY "Assistente geral visualiza publicacoes" ON public.publicacoes_djen FOR SELECT TO authenticated USING (public.is_assistente_juridico_geral(auth.uid()));
CREATE POLICY "Assistente geral visualiza monitoramentos" ON public.monitoramentos_djen FOR SELECT TO authenticated USING (public.is_assistente_juridico_geral(auth.uid()));

-- Escrita: só itens em que é responsável ou envolvido
CREATE OR REPLACE FUNCTION public.assistente_geral_pode_editar(_user_id uuid, _tabela text, _id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE _tabela
    WHEN 'tarefas' THEN EXISTS (SELECT 1 FROM tarefas t WHERE t.id=_id AND t.responsavel_id=_user_id)
      OR EXISTS (SELECT 1 FROM tarefa_responsaveis WHERE tarefa_id=_id AND usuario_id=_user_id)
      OR EXISTS (SELECT 1 FROM tarefa_envolvidos WHERE tarefa_id=_id AND usuario_id=_user_id)
    WHEN 'eventos_agenda' THEN EXISTS (SELECT 1 FROM evento_responsaveis WHERE evento_id=_id AND usuario_id=_user_id)
      OR EXISTS (SELECT 1 FROM evento_envolvidos WHERE evento_id=_id AND usuario_id=_user_id)
      OR EXISTS (SELECT 1 FROM participantes_evento WHERE evento_id=_id AND usuario_id=_user_id)
    WHEN 'audiencias_detectadas' THEN EXISTS (SELECT 1 FROM audiencia_envolvidos WHERE audiencia_id=_id AND usuario_id=_user_id)
      OR EXISTS (SELECT 1 FROM audiencias_advogados WHERE audiencia_id=_id AND advogado_id=_user_id)
    ELSE false END
$$;
REVOKE EXECUTE ON FUNCTION public.assistente_geral_pode_editar(uuid,text,uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.assistente_geral_pode_editar(uuid,text,uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.bloquear_edicao_assistente_geral()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _id uuid := COALESCE(OLD.id, NEW.id);
BEGIN
  IF auth.uid() IS NOT NULL AND public.is_assistente_juridico_geral(auth.uid())
     AND NOT public.assistente_geral_pode_editar(auth.uid(), TG_TABLE_NAME, _id) THEN
    RAISE EXCEPTION 'Somente acompanhamento: você não é responsável nem envolvido neste item.' USING ERRCODE='42501';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_bloq_assist_geral_tarefas BEFORE UPDATE OR DELETE ON public.tarefas FOR EACH ROW EXECUTE FUNCTION public.bloquear_edicao_assistente_geral();
CREATE TRIGGER trg_bloq_assist_geral_eventos BEFORE UPDATE OR DELETE ON public.eventos_agenda FOR EACH ROW EXECUTE FUNCTION public.bloquear_edicao_assistente_geral();
CREATE TRIGGER trg_bloq_assist_geral_audiencias BEFORE UPDATE OR DELETE ON public.audiencias_detectadas FOR EACH ROW EXECUTE FUNCTION public.bloquear_edicao_assistente_geral();

-- Permite que edite tarefas onde é responsável/envolvido mesmo fora de suas coordenações
CREATE POLICY "Assistente geral edita tarefas delegadas" ON public.tarefas FOR UPDATE TO authenticated
  USING (public.is_assistente_juridico_geral(auth.uid()) AND public.assistente_geral_pode_editar(auth.uid(),'tarefas',id))
  WITH CHECK (public.is_assistente_juridico_geral(auth.uid()));
CREATE POLICY "Assistente geral edita eventos delegados" ON public.eventos_agenda FOR UPDATE TO authenticated
  USING (public.is_assistente_juridico_geral(auth.uid()) AND public.assistente_geral_pode_editar(auth.uid(),'eventos_agenda',id))
  WITH CHECK (public.is_assistente_juridico_geral(auth.uid()));
CREATE POLICY "Assistente geral edita audiencias delegadas" ON public.audiencias_detectadas FOR UPDATE TO authenticated
  USING (public.is_assistente_juridico_geral(auth.uid()) AND public.assistente_geral_pode_editar(auth.uid(),'audiencias_detectadas',id))
  WITH CHECK (public.is_assistente_juridico_geral(auth.uid()));