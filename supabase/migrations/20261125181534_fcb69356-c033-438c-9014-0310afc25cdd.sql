CREATE OR REPLACE FUNCTION public._agenda_tarefas_visiveis(
  p_ini date, p_fim date, p_recorrentes boolean, p_usuario uuid, p_coords uuid[])
RETURNS SETOF public.tarefas
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_admin boolean;
  v_ass boolean;
  v_ativo boolean;
  v_vc uuid[];
BEGIN
  IF v_uid IS NULL THEN RETURN; END IF;
  v_admin := is_admin_or_coordenador(v_uid);
  v_ass := is_assistente_juridico_geral(v_uid);
  v_ativo := is_user_active(v_uid);
  SELECT coalesce(array_agg(m.coordenacao_id), '{}') INTO v_vc
    FROM membros_coordenacao m JOIN coordenacoes c ON c.id = m.coordenacao_id
   WHERE m.usuario_id = v_uid AND c.escritorio_visao_completa = true;

  RETURN QUERY
  SELECT t.* FROM tarefas t
   WHERE (CASE WHEN p_recorrentes
               THEN t.recorrencia_tipo IS NOT NULL AND t.data_vencimento < p_ini
               ELSE t.data_vencimento >= p_ini AND t.data_vencimento <= p_fim END)
     AND (p_coords IS NULL OR t.coordenacao_id = ANY(p_coords))
     AND (p_usuario IS NULL OR t.id IN (
            SELECT t0.id FROM tarefas t0 WHERE t0.responsavel_id = p_usuario
            UNION SELECT tr.tarefa_id FROM tarefa_responsaveis tr WHERE tr.usuario_id = p_usuario
            UNION SELECT te.tarefa_id FROM tarefa_envolvidos te WHERE te.usuario_id = p_usuario))
     AND (CASE
            WHEN v_admin OR v_ass THEN true
            WHEN t.coordenacao_id IS NOT NULL AND t.coordenacao_id = ANY(v_vc) THEN true
            WHEN NOT v_ativo THEN false
            WHEN t.processo_id IS NULL OR t.responsavel_id = v_uid OR t.criado_por = v_uid THEN true
            WHEN sou_participante_tarefa(t.id) THEN true
            ELSE can_access_processo(v_uid, t.processo_id)
          END);
END $$;

REVOKE ALL ON FUNCTION public._agenda_tarefas_visiveis(date, date, boolean, uuid, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public._agenda_tarefas_visiveis(date, date, boolean, uuid, uuid[]) TO authenticated, service_role;

DO $$
DECLARE d text;
BEGIN
  d := pg_get_functiondef('public.get_agenda_escritorio'::regproc);
  d := replace(d, 'FROM tarefas t2', 'FROM public._agenda_tarefas_visiveis(v_ini, v_fim, false, NULL::uuid, v_coords) t2');
  d := replace(d, 'FROM tarefas t3', 'FROM public._agenda_tarefas_visiveis(v_ini, v_fim, true, NULL::uuid, v_coords) t3');
  EXECUTE d;
  d := pg_get_functiondef('public.get_agenda_pessoal'::regproc);
  d := replace(d, 'FROM tarefas t2', 'FROM public._agenda_tarefas_visiveis(v_ini, v_fim, false, p_usuario, NULL::uuid[]) t2');
  d := replace(d, 'FROM tarefas t3', 'FROM public._agenda_tarefas_visiveis(v_ini, v_fim, true, p_usuario, NULL::uuid[]) t3');
  EXECUTE d;
END $$;