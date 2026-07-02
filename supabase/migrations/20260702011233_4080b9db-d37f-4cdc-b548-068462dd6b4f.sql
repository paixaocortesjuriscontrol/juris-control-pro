CREATE OR REPLACE FUNCTION public.get_djen_stats_servidor_per_user(
  p_coordenacao_id uuid DEFAULT NULL::uuid,
  p_inicio timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_fim timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_tipo_origem text DEFAULT NULL::text,
  p_search_query text DEFAULT NULL::text,
  p_monitoramento_id uuid DEFAULT NULL::uuid,
  p_data_disponibilizacao_inicio timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_data_disponibilizacao_fim timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_tribunal text DEFAULT NULL::text,
  p_dedup boolean DEFAULT false,
  p_apenas_hoje boolean DEFAULT false
)
RETURNS TABLE(
  total_termos bigint,
  total_processos bigint,
  nao_lidas_termos bigint,
  nao_lidas_processos bigint,
  total_unicas bigint,
  nao_lidas_unicas bigint,
  total_bruto bigint
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '12s'
AS $function$
DECLARE
  v_uid uuid;
  v_q text;
  v_q_digits text;
  v_tipo text;
  v_is_admin boolean;
  v_tribunal text;
  v_dia_inicio timestamp with time zone;
  v_dia_fim timestamp with time zone;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '28000';
  END IF;

  v_is_admin := public.is_admin_or_coordenador(v_uid);
  IF p_coordenacao_id IS NOT NULL AND NOT v_is_admin
     AND NOT EXISTS (
       SELECT 1 FROM public.membros_coordenacao mc
       WHERE mc.coordenacao_id = p_coordenacao_id AND mc.usuario_id = v_uid
     )
  THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  v_tipo := NULLIF(btrim(COALESCE(p_tipo_origem, '')), '');
  IF v_tipo IN ('todos', 'normal') THEN v_tipo := NULL; END IF;
  v_q := NULLIF(btrim(p_search_query), '');
  v_q_digits := CASE WHEN v_q IS NOT NULL THEN regexp_replace(v_q, '[^0-9]', '', 'g') ELSE NULL END;
  IF v_q_digits IS NOT NULL AND length(v_q_digits) < 5 THEN v_q_digits := NULL; END IF;
  v_tribunal := NULLIF(regexp_replace(upper(COALESCE(p_tribunal, '')), '[^A-Z0-9]', '', 'g'), '');

  IF p_inicio IS NOT NULL THEN
    v_dia_inicio := ((p_inicio AT TIME ZONE 'America/Sao_Paulo')::date)::timestamp AT TIME ZONE 'UTC';
    v_dia_fim := (((p_inicio AT TIME ZONE 'America/Sao_Paulo')::date + 1)::timestamp AT TIME ZONE 'UTC') - interval '1 millisecond';
  END IF;

  RETURN QUERY
  WITH base AS (
    SELECT
      ps.id,
      'termo'::text AS tipo_origem,
      ps.created_at,
      COALESCE(ps.coordenacao_id, md.coordenacao_id) AS dedup_coord,
      CASE
        WHEN NULLIF(btrim(ps.id_djen), '') IS NOT NULL THEN 'id_djen|' || btrim(ps.id_djen)
        WHEN NULLIF(btrim(ps.dedup_key), '') IS NOT NULL THEN 'dedup|' || btrim(ps.dedup_key)
        ELSE 'row|' || ps.id::text
      END AS dedup_uid,
      EXISTS (
        SELECT 1 FROM public.publicacoes_djen_leituras l
        WHERE l.publicacao_id = ps.id
          AND l.tabela_origem = 'termo'
          AND l.usuario_id = v_uid
      ) AS lida_por_user
    FROM public.publicacoes_djen_servidor ps
    LEFT JOIN public.monitoramentos_djen md ON md.id = ps.monitoramento_id
    WHERE (v_tipo IS NULL OR v_tipo IN ('termo', 'parte', 'djet-pautas', 'kurier'))
      AND (v_tipo IS DISTINCT FROM 'parte' OR lower(COALESCE(md.tipo, '')) = 'parte')
      AND (v_tipo IS DISTINCT FROM 'djet-pautas' OR ps.tipo_publicacao = 'pauta')
      AND (v_tipo IS DISTINCT FROM 'kurier' OR lower(COALESCE(ps.fonte, ps.origem, '')) = 'kurier')
      AND (v_tipo = 'djet-pautas' OR COALESCE(ps.tipo_publicacao, '') <> 'pauta')
      AND (p_monitoramento_id IS NULL OR ps.monitoramento_id = p_monitoramento_id)
      AND (
        p_coordenacao_id IS NULL
        OR ps.coordenacao_id = p_coordenacao_id
        OR (ps.coordenacao_id IS NULL AND md.coordenacao_id = p_coordenacao_id)
      )
      AND (
        v_is_admin
        OR EXISTS (
          SELECT 1 FROM public.membros_coordenacao mc
          WHERE mc.coordenacao_id = COALESCE(ps.coordenacao_id, md.coordenacao_id)
            AND mc.usuario_id = v_uid
        )
      )
      AND (
        p_inicio IS NULL OR
        CASE
          WHEN p_apenas_hoje THEN (
            (
              lower(COALESCE(ps.fonte, '')) = 'kurier'
              AND (
                (ps.data_disponibilizacao >= v_dia_inicio AND ps.data_disponibilizacao <= v_dia_fim)
                OR (ps.data_disponibilizacao IS NULL AND ps.created_at >= p_inicio AND (p_fim IS NULL OR ps.created_at <= p_fim))
              )
            ) OR (
              lower(COALESCE(ps.fonte, '')) <> 'kurier' OR ps.fonte IS NULL
            ) AND (
              (p_fim IS NOT NULL AND ps.data_publicacao >= p_inicio AND ps.data_publicacao <= p_fim)
              OR (ps.data_publicacao >= v_dia_inicio AND ps.data_publicacao <= v_dia_fim)
              OR (p_fim IS NOT NULL AND ps.data_disponibilizacao >= p_inicio AND ps.data_disponibilizacao <= p_fim)
              OR (ps.data_disponibilizacao >= v_dia_inicio AND ps.data_disponibilizacao <= v_dia_fim)
              OR (ps.data_publicacao IS NULL AND ps.data_disponibilizacao IS NULL AND ps.created_at >= p_inicio AND (p_fim IS NULL OR ps.created_at <= p_fim))
            )
          )
          ELSE ps.created_at >= p_inicio
        END
      )
      AND (p_fim IS NULL OR p_apenas_hoje OR ps.created_at <= p_fim)
      AND (
        p_data_disponibilizacao_inicio IS NULL
        OR (
          v_tipo = 'djet-pautas'
          AND ps.data_disponibilizacao >= (((p_data_disponibilizacao_inicio AT TIME ZONE 'UTC')::date)::timestamp AT TIME ZONE 'UTC')
        )
        OR (v_tipo IS DISTINCT FROM 'djet-pautas' AND ps.data_disponibilizacao >= p_data_disponibilizacao_inicio)
      )
      AND (
        p_data_disponibilizacao_fim IS NULL
        OR (
          v_tipo = 'djet-pautas'
          AND ps.data_disponibilizacao <= ((((p_data_disponibilizacao_fim AT TIME ZONE 'UTC')::date + 1)::timestamp AT TIME ZONE 'UTC') - interval '1 millisecond')
        )
        OR (v_tipo IS DISTINCT FROM 'djet-pautas' AND ps.data_disponibilizacao <= p_data_disponibilizacao_fim)
      )
      AND (v_tribunal IS NULL OR upper(COALESCE(ps.tribunal, ps.fonte, '')) ~ ('(^|[^A-Z0-9])' || v_tribunal || '([^A-Z0-9]|$)'))
      AND (
        v_q IS NULL
        OR ps.conteudo ILIKE ('%' || v_q || '%')
        OR ps.processo_numero ILIKE ('%' || v_q || '%')
        OR md.termo_busca ILIKE ('%' || v_q || '%')
        OR (v_q_digits IS NOT NULL AND regexp_replace(COALESCE(ps.processo_numero, ''), '[^0-9]', '', 'g') LIKE ('%' || v_q_digits || '%'))
      )
  ),
  deduped AS (
    SELECT DISTINCT ON (b.dedup_coord, b.dedup_uid)
      b.id,
      b.lida_por_user
    FROM base b
    ORDER BY b.dedup_coord, b.dedup_uid, b.lida_por_user ASC, b.created_at DESC, b.id ASC
  ),
  bruto AS (
    SELECT
      COUNT(*)::bigint AS total_termos,
      COUNT(*) FILTER (WHERE NOT b.lida_por_user)::bigint AS nao_lidas_termos,
      COUNT(*)::bigint AS total_bruto
    FROM base b
  ),
  unicas AS (
    SELECT
      COUNT(*)::bigint AS total_unicas,
      COUNT(*) FILTER (WHERE NOT d.lida_por_user)::bigint AS nao_lidas_unicas
    FROM deduped d
  )
  SELECT
    bruto.total_termos,
    0::bigint AS total_processos,
    bruto.nao_lidas_termos,
    0::bigint AS nao_lidas_processos,
    unicas.total_unicas,
    unicas.nao_lidas_unicas,
    bruto.total_bruto
  FROM bruto CROSS JOIN unicas;
END;
$function$;