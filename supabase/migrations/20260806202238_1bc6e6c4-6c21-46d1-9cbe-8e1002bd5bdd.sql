
CREATE OR REPLACE FUNCTION public.get_indicadores_atividades(
  p_inicio timestamptz,
  p_fim timestamptz DEFAULT NULL,
  p_coordenacao_id uuid DEFAULT NULL,
  p_usuario_id uuid DEFAULT NULL,
  p_agrupamento text DEFAULT 'mes'
)
RETURNS TABLE (periodo text, prazos bigint, audiencias bigint, eventos bigint, tarefas bigint)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_admin boolean;
  v_priv boolean;
  v_coords uuid[];
  v_fmt text := CASE WHEN p_agrupamento = 'ano' THEN 'YYYY' ELSE 'YYYY-MM' END;
  v_coord_filter uuid[];
  v_user_filter uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT EXISTS (SELECT 1 FROM user_roles WHERE user_id = v_uid AND role = 'admin') INTO v_admin;
  SELECT v_admin OR EXISTS (
    SELECT 1 FROM user_roles WHERE user_id = v_uid AND role IN ('coordenador','assistente_coordenador')
  ) INTO v_priv;

  SELECT array_agg(DISTINCT c) INTO v_coords FROM (
    SELECT coordenacao_id AS c FROM membros_coordenacao WHERE usuario_id = v_uid
    UNION
    SELECT id FROM coordenacoes WHERE coordenador_id = v_uid
  ) s WHERE c IS NOT NULL;

  IF NOT v_priv THEN
    v_user_filter := v_uid;
    v_coord_filter := NULL;
  ELSE
    v_user_filter := p_usuario_id;
    IF p_coordenacao_id IS NOT NULL THEN
      IF v_admin OR p_coordenacao_id = ANY (COALESCE(v_coords, '{}'::uuid[])) THEN
        v_coord_filter := ARRAY[p_coordenacao_id];
      ELSE
        v_coord_filter := ARRAY[]::uuid[];
      END IF;
    ELSIF v_admin THEN
      v_coord_filter := NULL;
    ELSE
      v_coord_filter := COALESCE(v_coords, ARRAY[]::uuid[]);
    END IF;
  END IF;

  RETURN QUERY
  WITH t AS (
    SELECT
      to_char(COALESCE(tf.data_cumprimento::timestamptz, tf.updated_at), v_fmt) AS periodo,
      CASE
        WHEN lower(COALESCE(tf.tipo_tarefa, '')) LIKE 'prazo%' THEN 'prazos'
        WHEN lower(COALESCE(tf.tipo_tarefa, '')) LIKE 'evento%' THEN 'eventos'
        WHEN lower(COALESCE(tf.tipo_tarefa, '')) LIKE 'audi%' THEN 'audiencias'
        ELSE 'tarefas'
      END AS grupo
    FROM tarefas tf
    WHERE tf.status = 'cumprido'
      AND COALESCE(tf.data_cumprimento::timestamptz, tf.updated_at) >= p_inicio
      AND (p_fim IS NULL OR COALESCE(tf.data_cumprimento::timestamptz, tf.updated_at) < p_fim)
      AND (v_coord_filter IS NULL OR tf.coordenacao_id = ANY (v_coord_filter))
      AND (
        v_user_filter IS NULL
        OR tf.responsavel_id = v_user_filter
        OR EXISTS (SELECT 1 FROM tarefa_responsaveis tr WHERE tr.tarefa_id = tf.id AND tr.usuario_id = v_user_filter)
      )

    UNION ALL

    SELECT
      to_char(COALESCE(a.tratado_em, a.updated_at), v_fmt) AS periodo,
      'audiencias' AS grupo
    FROM audiencias_detectadas a
    WHERE a.status IN ('tratado','concluido')
      AND COALESCE(a.tratado_em, a.updated_at) >= p_inicio
      AND (p_fim IS NULL OR COALESCE(a.tratado_em, a.updated_at) < p_fim)
      AND (v_coord_filter IS NULL OR a.coordenacao_id = ANY (v_coord_filter))
      AND (
        v_user_filter IS NULL
        OR a.tratado_por = v_user_filter
        OR a.criado_por = v_user_filter
        OR EXISTS (SELECT 1 FROM audiencias_advogados aa WHERE aa.audiencia_id = a.id AND aa.advogado_id = v_user_filter)
      )

    UNION ALL

    SELECT
      to_char(COALESCE(e.concluido_em, e.updated_at), v_fmt) AS periodo,
      'eventos' AS grupo
    FROM eventos_agenda e
    WHERE e.status IN ('concluido','cumprido','realizado','tratado')
      AND COALESCE(e.concluido_em, e.updated_at) >= p_inicio
      AND (p_fim IS NULL OR COALESCE(e.concluido_em, e.updated_at) < p_fim)
      AND (v_coord_filter IS NULL OR e.coordenacao_id = ANY (v_coord_filter))
      AND (
        v_user_filter IS NULL
        OR e.criado_por = v_user_filter
        OR EXISTS (SELECT 1 FROM evento_responsaveis er WHERE er.evento_id = e.id AND er.usuario_id = v_user_filter)
      )
  )
  SELECT
    t.periodo,
    COUNT(*) FILTER (WHERE t.grupo = 'prazos') AS prazos,
    COUNT(*) FILTER (WHERE t.grupo = 'audiencias') AS audiencias,
    COUNT(*) FILTER (WHERE t.grupo = 'eventos') AS eventos,
    COUNT(*) FILTER (WHERE t.grupo = 'tarefas') AS tarefas
  FROM t
  GROUP BY t.periodo
  ORDER BY t.periodo;
END;
$$;

REVOKE ALL ON FUNCTION public.get_indicadores_atividades(timestamptz, timestamptz, uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_indicadores_atividades(timestamptz, timestamptz, uuid, uuid, text) TO authenticated;
