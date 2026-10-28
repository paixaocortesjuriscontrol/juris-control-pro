CREATE OR REPLACE FUNCTION public.get_painel_totais(filters jsonb DEFAULT '{}'::jsonb)
RETURNS TABLE(tarefa bigint, ata bigint, evento bigint, prazo bigint, audiencia bigint, parcelamento bigint)
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path TO 'public'
AS $$
DECLARE
  v_ini date := NULLIF(filters->>'dataInicio','')::date;
  v_fim date := NULLIF(filters->>'dataFim','')::date;
  v_all boolean := COALESCE((filters->>'fetchAll')::boolean,false);
  v_coords uuid[] := CASE WHEN jsonb_typeof(filters->'coordenacaoIds')='array' AND jsonb_array_length(filters->'coordenacaoIds')>0
    THEN ARRAY(SELECT jsonb_array_elements_text(filters->'coordenacaoIds')::uuid) END;
  v_users uuid[] := CASE WHEN jsonb_typeof(filters->'responsavelIds')='array' AND jsonb_array_length(filters->'responsavelIds')>0
    THEN ARRAY(SELECT jsonb_array_elements_text(filters->'responsavelIds')::uuid) ELSE ARRAY[auth.uid()] END;
  v_fechados text[] := ARRAY['cumprido','concluido','concluido_sem_sucesso','tratado','cancelado','cancelado_oculto','protocolado','baixado','verificado'];
BEGIN
  RETURN QUERY
  WITH t AS (
    SELECT upper(btrim(coalesce(x.tipo_tarefa,''))) tt FROM tarefas x
    WHERE x.status::text <> ALL(v_fechados)
      AND (v_ini IS NULL OR x.data_vencimento >= v_ini) AND (v_fim IS NULL OR x.data_vencimento <= v_fim)
      AND (v_all OR (v_coords IS NOT NULL AND x.coordenacao_id = ANY(v_coords))
        OR (v_coords IS NULL AND (x.responsavel_id = ANY(v_users) OR x.criado_por = ANY(v_users)
          OR EXISTS (SELECT 1 FROM tarefa_responsaveis r WHERE r.tarefa_id=x.id AND r.usuario_id=ANY(v_users))
          OR EXISTS (SELECT 1 FROM tarefa_envolvidos e WHERE e.tarefa_id=x.id AND e.usuario_id=ANY(v_users)))))
  ), ev AS (
    SELECT lower(coalesce(x.tipo,'')) tp FROM eventos_agenda x
    WHERE coalesce(x.status,'pendente') <> ALL(v_fechados) AND lower(coalesce(x.tipo,'')) <> 'parcelamento'
      AND (v_ini IS NULL OR x.data_inicio >= v_ini) AND (v_fim IS NULL OR x.data_inicio < v_fim + 1)
      AND (v_all OR (v_coords IS NOT NULL AND x.coordenacao_id = ANY(v_coords))
        OR (v_coords IS NULL AND (x.criado_por = ANY(v_users)
          OR EXISTS (SELECT 1 FROM participantes_evento p WHERE p.evento_id=x.id AND p.usuario_id=ANY(v_users)))))
  ), au AS (
    SELECT 1 FROM audiencias_detectadas x
    WHERE coalesce(x.status,'pendente') <> ALL(v_fechados)
      AND (v_ini IS NULL OR x.data_audiencia >= v_ini) AND (v_fim IS NULL OR x.data_audiencia < v_fim + 1)
      AND (v_all OR (v_coords IS NOT NULL AND x.coordenacao_id = ANY(v_coords))
        OR (v_coords IS NULL AND (x.criado_por = ANY(v_users)
          OR EXISTS (SELECT 1 FROM audiencias_advogados a WHERE a.audiencia_id=x.id AND a.advogado_id=ANY(v_users))
          OR EXISTS (SELECT 1 FROM audiencia_envolvidos e WHERE e.audiencia_id=x.id AND e.usuario_id=ANY(v_users)))))
  ), pa AS (
    SELECT 1 FROM parcelas_evento p JOIN eventos_agenda x ON x.id=p.evento_id
    WHERE coalesce(p.status,'pendente') <> ALL(v_fechados)
      AND (v_ini IS NULL OR p.data_vencimento >= v_ini) AND (v_fim IS NULL OR p.data_vencimento <= v_fim)
      AND (v_all OR (v_coords IS NOT NULL AND x.coordenacao_id = ANY(v_coords))
        OR (v_coords IS NULL AND (x.criado_por = ANY(v_users)
          OR EXISTS (SELECT 1 FROM participantes_evento q WHERE q.evento_id=x.id AND q.usuario_id=ANY(v_users)))))
  )
  SELECT
    (SELECT count(*) FROM t WHERE tt NOT IN ('ATA','PRAZO','AUDIÊNCIA','AUDIENCIA','EVENTO','PARCELAMENTO','PARCELAMENTO_RECORRENTE')),
    (SELECT count(*) FROM t WHERE tt='ATA'),
    (SELECT count(*) FROM t WHERE tt IN ('EVENTO')) + (SELECT count(*) FROM ev WHERE tp NOT IN ('prazo','prazo_parcela','audiencia')),
    (SELECT count(*) FROM t WHERE tt='PRAZO') + (SELECT count(*) FROM ev WHERE tp IN ('prazo','prazo_parcela')),
    (SELECT count(*) FROM t WHERE tt IN ('AUDIÊNCIA','AUDIENCIA')) + (SELECT count(*) FROM ev WHERE tp='audiencia') + (SELECT count(*) FROM au),
    (SELECT count(*) FROM t WHERE tt IN ('PARCELAMENTO','PARCELAMENTO_RECORRENTE')) + (SELECT count(*) FROM pa);
END $$;
GRANT EXECUTE ON FUNCTION public.get_painel_totais(jsonb) TO authenticated;