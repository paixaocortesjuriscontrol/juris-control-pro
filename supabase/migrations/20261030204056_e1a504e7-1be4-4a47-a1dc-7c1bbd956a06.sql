CREATE OR REPLACE FUNCTION public._pode_gerir_coordenacao(_coord uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public AS $$
  select public.has_role(auth.uid(),'admin') or exists(
    select 1 from membros_coordenacao m where m.coordenacao_id=_coord and m.usuario_id=auth.uid()
      and lower(replace(m.cargo,' ','_')) in ('coordenador','assistente_coordenador'))
$$;

CREATE OR REPLACE FUNCTION public.contar_vinculos_usuario_coordenacao(_usuario uuid, _coordenacao_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=public AS $$
DECLARE r jsonb;
BEGIN
  IF NOT public._pode_gerir_coordenacao(_coordenacao_id) THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  WITH abertas AS (select id, responsavel_id from tarefas where coordenacao_id=_coordenacao_id
     and status in ('pendente','atrasado','a_confirmar','em_execucao','revisao','minutado_revisao','reagendado'))
  select jsonb_build_object(
    'tarefas_responsavel', (select count(distinct a.id) from abertas a where a.responsavel_id=_usuario
        or exists(select 1 from tarefa_responsaveis r where r.tarefa_id=a.id and r.usuario_id=_usuario)),
    'tarefas_sozinha', (select count(*) from abertas a where (a.responsavel_id=_usuario or exists(select 1 from tarefa_responsaveis r where r.tarefa_id=a.id and r.usuario_id=_usuario))
        and coalesce(a.responsavel_id,_usuario)=_usuario
        and not exists(select 1 from tarefa_responsaveis r where r.tarefa_id=a.id and r.usuario_id<>_usuario)),
    'tarefas_envolvida', (select count(*) from tarefa_envolvidos e join abertas a on a.id=e.tarefa_id where e.usuario_id=_usuario),
    'eventos', (select count(*) from evento_responsaveis e join eventos_agenda v on v.id=e.evento_id where e.usuario_id=_usuario and v.coordenacao_id=_coordenacao_id and v.status in ('pendente','revisao','reagendado')),
    'audiencias', (select count(*) from audiencia_envolvidos e join audiencias_detectadas v on v.id=e.audiencia_id where e.usuario_id=_usuario and v.coordenacao_id=_coordenacao_id and v.status in ('pendente','revisao','reagendado')),
    'etapas_workflow', (select count(distinct et.id) from workflow_etapas et join workflows w on w.id=et.workflow_id where w.coordenacao_id=_coordenacao_id and (et.responsavel_id=_usuario
        or exists(select 1 from workflow_etapa_responsaveis x where x.etapa_id=et.id and x.usuario_id=_usuario)
        or exists(select 1 from workflow_etapa_envolvidos x where x.etapa_id=et.id and x.usuario_id=_usuario))),
    'responsaveis_fixos', (select count(*) from responsaveis_fixos_tipo_tarefa f where f.coordenacao_id=_coordenacao_id and (_usuario = any(f.responsaveis) or _usuario = any(f.envolvidos)))
  ) into r;
  RETURN r;
END $$;

CREATE OR REPLACE FUNCTION public.desvincular_usuario_coordenacao(_usuario uuid, _coordenacao_id uuid, _substituto uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE v_sem_resp uuid[]; v_trocadas int := 0; v_tarefas int := 0;
BEGIN
  IF NOT public._pode_gerir_coordenacao(_coordenacao_id) THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  IF _substituto = _usuario THEN _substituto := NULL; END IF;
  PERFORM set_config('app.sem_notificacao','1',true);

  CREATE TEMP TABLE _abertas ON COMMIT DROP AS
    select t.id from tarefas t where t.coordenacao_id=_coordenacao_id
      and t.status in ('pendente','atrasado','a_confirmar','em_execucao','revisao','minutado_revisao','reagendado')
      and (t.responsavel_id=_usuario or exists(select 1 from tarefa_responsaveis r where r.tarefa_id=t.id and r.usuario_id=_usuario));
  select count(*) into v_tarefas from _abertas;

  -- substituto onde ela era a única responsável
  IF _substituto IS NOT NULL THEN
    insert into tarefa_responsaveis(tarefa_id, usuario_id)
    select a.id, _substituto from _abertas a
    where not exists(select 1 from tarefa_responsaveis r where r.tarefa_id=a.id and r.usuario_id<>_usuario);
    GET DIAGNOSTICS v_trocadas = ROW_COUNT;
  END IF;

  delete from tarefa_responsaveis r using _abertas a where r.tarefa_id=a.id and r.usuario_id=_usuario;

  update tarefas t set responsavel_id = (select r.usuario_id from tarefa_responsaveis r where r.tarefa_id=t.id order by r.created_at limit 1)
  from _abertas a where a.id=t.id and t.responsavel_id=_usuario
    and exists(select 1 from tarefa_responsaveis r where r.tarefa_id=t.id);

  select coalesce(array_agg(t.id),'{}') into v_sem_resp from tarefas t join _abertas a on a.id=t.id where t.responsavel_id=_usuario;

  delete from tarefa_envolvidos e using tarefas t where e.tarefa_id=t.id and e.usuario_id=_usuario and t.coordenacao_id=_coordenacao_id
    and t.status in ('pendente','atrasado','a_confirmar','em_execucao','revisao','minutado_revisao','reagendado');
  delete from evento_responsaveis e using eventos_agenda v where e.evento_id=v.id and e.usuario_id=_usuario and v.coordenacao_id=_coordenacao_id and v.status in ('pendente','revisao','reagendado');
  delete from audiencia_envolvidos e using audiencias_detectadas v where e.audiencia_id=v.id and e.usuario_id=_usuario and v.coordenacao_id=_coordenacao_id and v.status in ('pendente','revisao','reagendado');

  IF _substituto IS NOT NULL THEN
    insert into workflow_etapa_responsaveis(etapa_id, usuario_id)
    select x.etapa_id, _substituto from workflow_etapa_responsaveis x join workflow_etapas et on et.id=x.etapa_id join workflows w on w.id=et.workflow_id
    where w.coordenacao_id=_coordenacao_id and x.usuario_id=_usuario
      and not exists(select 1 from workflow_etapa_responsaveis y where y.etapa_id=x.etapa_id and y.usuario_id=_substituto);
  END IF;
  delete from workflow_etapa_responsaveis x using workflow_etapas et, workflows w where et.id=x.etapa_id and w.id=et.workflow_id and w.coordenacao_id=_coordenacao_id and x.usuario_id=_usuario;
  delete from workflow_etapa_envolvidos x using workflow_etapas et, workflows w where et.id=x.etapa_id and w.id=et.workflow_id and w.coordenacao_id=_coordenacao_id and x.usuario_id=_usuario;
  update workflow_etapas et set responsavel_id=_substituto from workflows w where w.id=et.workflow_id and w.coordenacao_id=_coordenacao_id and et.responsavel_id=_usuario;

  update responsaveis_fixos_tipo_tarefa f set
    responsaveis = (select coalesce(array_agg(distinct u),'{}') from unnest(array_replace(f.responsaveis,_usuario,_substituto)) u where u is not null),
    envolvidos = (select coalesce(array_agg(distinct u),'{}') from unnest(array_remove(f.envolvidos,_usuario)) u)
  where f.coordenacao_id=_coordenacao_id and (_usuario = any(f.responsaveis) or _usuario = any(f.envolvidos));

  RETURN jsonb_build_object('tarefas', v_tarefas, 'substituidas', v_trocadas, 'sem_responsavel', to_jsonb(v_sem_resp));
END $$;

GRANT EXECUTE ON FUNCTION public.contar_vinculos_usuario_coordenacao(uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.desvincular_usuario_coordenacao(uuid,uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public._pode_gerir_coordenacao(uuid) TO authenticated;