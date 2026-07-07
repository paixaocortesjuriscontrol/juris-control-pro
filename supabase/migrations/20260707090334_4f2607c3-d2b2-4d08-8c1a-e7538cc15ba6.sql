CREATE OR REPLACE FUNCTION public.mirror_publicacao_djen_servidor_to_unificada()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.publicacoes_djen (
    id,
    monitoramento_id,
    hash_conteudo,
    data_publicacao,
    data_disponibilizacao,
    processo_numero,
    conteudo,
    fonte,
    tribunal,
    polo_ativo,
    polo_passivo,
    orgao,
    tipo_comunicacao,
    meio,
    advogados_json,
    partes_json,
    dedup_processo_digits,
    dedup_data_ref,
    dedup_head_norm,
    dedup_key,
    dedup_conteudo_key,
    coordenacao_id,
    tipo_publicacao,
    id_djen,
    kurier_login,
    execucao_id,
    created_at,
    status
  ) VALUES (
    NEW.id,
    NEW.monitoramento_id,
    NEW.hash_conteudo,
    NEW.data_publicacao,
    NEW.data_disponibilizacao,
    NEW.processo_numero,
    NEW.conteudo,
    COALESCE(NULLIF(NEW.fonte, ''), NULLIF(NEW.origem, ''), 'djen-servidor'),
    NEW.tribunal,
    NEW.polo_ativo,
    NEW.polo_passivo,
    NEW.orgao,
    NEW.tipo_comunicacao,
    NEW.meio,
    NEW.advogados_json,
    COALESCE(NEW.partes_json, '[]'::jsonb),
    NEW.dedup_processo_digits,
    NEW.dedup_data_ref,
    NEW.dedup_head_norm,
    NEW.dedup_key,
    NEW.dedup_conteudo_key,
    NEW.coordenacao_id,
    COALESCE(NULLIF(NEW.tipo_publicacao, ''), 'intimacao'),
    NEW.id_djen,
    NEW.kurier_login,
    NEW.execucao_id,
    COALESCE(NEW.created_at, now()),
    'encontrada'
  )
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_mirror_publicacao_djen_servidor_to_unificada ON public.publicacoes_djen_servidor;
CREATE TRIGGER trg_mirror_publicacao_djen_servidor_to_unificada
AFTER INSERT ON public.publicacoes_djen_servidor
FOR EACH ROW
EXECUTE FUNCTION public.mirror_publicacao_djen_servidor_to_unificada();

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
AS $$
DECLARE
  v_uid uuid;
  v_q text;
  v_q_digits text;
  v_q_cnj text;
  v_q_unaccent text;
  v_tipo text;
  v_is_admin boolean;
  v_tribunal text;
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
  v_q_cnj := CASE WHEN v_q_digits IS NOT NULL AND length(v_q_digits) = 20 THEN
    format('%s-%s.%s.%s.%s.%s',
      substring(v_q_digits from 1 for 7), substring(v_q_digits from 8 for 2),
      substring(v_q_digits from 10 for 4), substring(v_q_digits from 14 for 1),
      substring(v_q_digits from 15 for 2), substring(v_q_digits from 17 for 4))
    ELSE NULL END;
  v_q_unaccent := CASE WHEN v_q IS NOT NULL THEN lower(public.unaccent(v_q)) ELSE NULL END;
  v_tribunal := NULLIF(regexp_replace(upper(COALESCE(p_tribunal, '')), '[^A-Z0-9]', '', 'g'), '');

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
    FROM public.publicacoes_djen ps
    LEFT JOIN public.monitoramentos_djen md ON md.id = ps.monitoramento_id
    WHERE (v_tipo IS NULL OR v_tipo IN ('termo', 'parte', 'djet-pautas', 'kurier'))
      AND (v_tipo IS DISTINCT FROM 'parte' OR lower(COALESCE(md.tipo, '')) = 'parte')
      AND (v_tipo IS DISTINCT FROM 'djet-pautas' OR ps.tipo_publicacao = 'pauta')
      AND (v_tipo IS DISTINCT FROM 'kurier' OR lower(COALESCE(ps.fonte, '')) = 'kurier')
      AND (v_tipo = 'djet-pautas' OR COALESCE(ps.tipo_publicacao, '') <> 'pauta')
      AND COALESCE(ps.fonte, '') <> 'dejt-pdf'
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
      AND ps.status IN ('encontrada','duplicada')
      AND (p_inicio IS NULL OR ps.created_at >= p_inicio)
      AND (p_fim IS NULL OR ps.created_at <= p_fim)
      AND (
        p_data_disponibilizacao_inicio IS NULL
        OR (
          v_tipo = 'djet-pautas'
          AND ps.data_disponibilizacao >= (((p_data_disponibilizacao_inicio AT TIME ZONE 'UTC')::date)::timestamp AT TIME ZONE 'UTC')
        )
        OR (
          v_tipo IS DISTINCT FROM 'djet-pautas'
          AND CASE
            WHEN lower(COALESCE(ps.fonte, '')) = 'kurier'
              THEN (ps.created_at AT TIME ZONE 'America/Sao_Paulo')::date >= (p_data_disponibilizacao_inicio AT TIME ZONE 'America/Sao_Paulo')::date
            ELSE ps.data_disponibilizacao >= p_data_disponibilizacao_inicio
          END
        )
      )
      AND (
        p_data_disponibilizacao_fim IS NULL
        OR (
          v_tipo = 'djet-pautas'
          AND ps.data_disponibilizacao <= ((((p_data_disponibilizacao_fim AT TIME ZONE 'UTC')::date + 1)::timestamp AT TIME ZONE 'UTC') - interval '1 millisecond')
        )
        OR (
          v_tipo IS DISTINCT FROM 'djet-pautas'
          AND CASE
            WHEN lower(COALESCE(ps.fonte, '')) = 'kurier'
              THEN (ps.created_at AT TIME ZONE 'America/Sao_Paulo')::date <= (p_data_disponibilizacao_fim AT TIME ZONE 'America/Sao_Paulo')::date
            ELSE ps.data_disponibilizacao <= p_data_disponibilizacao_fim
          END
        )
      )
      AND (v_tribunal IS NULL OR upper(COALESCE(ps.tribunal, ps.fonte, '')) ~ ('(^|[^A-Z0-9])' || v_tribunal || '([^A-Z0-9]|$)'))
      AND (
        v_q IS NULL
        OR ps.conteudo ILIKE ('%' || v_q || '%')
        OR ps.processo_numero ILIKE ('%' || v_q || '%')
        OR md.termo_busca ILIKE ('%' || v_q || '%')
        OR COALESCE(md.descricao, '') ILIKE ('%' || v_q || '%')
        OR COALESCE(ps.advogados_json::text, '') ILIKE ('%' || v_q || '%')
        OR (v_q_unaccent IS NOT NULL AND (
          lower(public.unaccent(COALESCE(ps.processo_numero, ''))) LIKE ('%' || v_q_unaccent || '%')
          OR lower(public.unaccent(COALESCE(md.termo_busca, ''))) LIKE ('%' || v_q_unaccent || '%')
          OR lower(public.unaccent(COALESCE(md.descricao, ''))) LIKE ('%' || v_q_unaccent || '%')
          OR lower(public.unaccent(COALESCE(ps.advogados_json::text, ''))) LIKE ('%' || v_q_unaccent || '%')
          OR lower(public.unaccent(COALESCE(ps.partes_json::text, ''))) LIKE ('%' || v_q_unaccent || '%')
          OR ((p_coordenacao_id IS NOT NULL OR p_data_disponibilizacao_inicio IS NOT NULL OR p_inicio IS NOT NULL)
              AND lower(public.unaccent(COALESCE(ps.conteudo, ''))) LIKE ('%' || v_q_unaccent || '%'))
        ))
        OR (v_q_cnj IS NOT NULL AND ps.conteudo ILIKE ('%' || v_q_cnj || '%'))
        OR (v_q_digits IS NOT NULL AND (
          regexp_replace(COALESCE(ps.processo_numero, ''), '[^0-9]', '', 'g') LIKE ('%' || v_q_digits || '%')
          OR ((p_coordenacao_id IS NOT NULL OR p_data_disponibilizacao_inicio IS NOT NULL OR p_inicio IS NOT NULL)
              AND regexp_replace(COALESCE(ps.conteudo, ''), '[^0-9]', '', 'g') LIKE ('%' || v_q_digits || '%'))
        ))
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
$$;

CREATE OR REPLACE FUNCTION public.get_djen_publicacoes_servidor_unificadas(
  p_coordenacao_id uuid DEFAULT NULL,
  p_inicio timestamptz DEFAULT NULL,
  p_fim timestamptz DEFAULT NULL,
  p_search_query text DEFAULT NULL,
  p_limit integer DEFAULT 500,
  p_offset integer DEFAULT 0,
  p_monitoramento_id uuid DEFAULT NULL,
  p_tipo_origem text DEFAULT NULL,
  p_read_status text DEFAULT 'todas',
  p_data_disponibilizacao_inicio timestamptz DEFAULT NULL,
  p_data_disponibilizacao_fim timestamptz DEFAULT NULL,
  p_tribunal text DEFAULT NULL,
  p_dedup boolean DEFAULT false,
  p_apenas_hoje boolean DEFAULT false
)
RETURNS TABLE(id uuid, id_djen text, tipo_origem text, processo_id uuid, processo_numero text, conteudo text, data_publicacao timestamptz, data_disponibilizacao timestamptz, fonte text, lida boolean, created_at timestamptz, monitoramento_id uuid, monitoramento_termo text, monitoramento_descricao text, monitoramento_tipo text, monitoramento_oab text, monitoramento_uf text, coordenacao_id uuid, coordenacao_nome text, polo_ativo text, polo_passivo text, tribunal text, orgao text, tipo_comunicacao text, meio text, advogados_json jsonb, partes_json jsonb, lido_por jsonb)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' SET statement_timeout TO '8s'
AS $$
DECLARE
  v_uid uuid; v_q text; v_q_digits text; v_q_cnj text; v_q_unaccent text; v_tipo text; v_read text;
  v_is_admin boolean; v_tribunal text;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not authenticated' USING ERRCODE = '28000'; END IF;
  v_is_admin := public.is_admin_or_coordenador(v_uid);
  IF p_coordenacao_id IS NOT NULL AND NOT v_is_admin
     AND NOT EXISTS (SELECT 1 FROM public.membros_coordenacao mc WHERE mc.coordenacao_id = p_coordenacao_id AND mc.usuario_id = v_uid)
  THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;

  v_tipo := NULLIF(btrim(COALESCE(p_tipo_origem, '')), '');
  IF v_tipo IN ('todos', 'normal') THEN v_tipo := NULL; END IF;
  v_read := COALESCE(NULLIF(btrim(p_read_status), ''), 'todas');
  v_q := NULLIF(btrim(p_search_query), '');
  v_q_digits := CASE WHEN v_q IS NOT NULL THEN regexp_replace(v_q, '[^0-9]', '', 'g') ELSE NULL END;
  IF v_q_digits IS NOT NULL AND length(v_q_digits) < 5 THEN v_q_digits := NULL; END IF;
  v_q_cnj := CASE WHEN v_q_digits IS NOT NULL AND length(v_q_digits) = 20 THEN
    format('%s-%s.%s.%s.%s.%s',
      substring(v_q_digits from 1 for 7), substring(v_q_digits from 8 for 2),
      substring(v_q_digits from 10 for 4), substring(v_q_digits from 14 for 1),
      substring(v_q_digits from 15 for 2), substring(v_q_digits from 17 for 4))
    ELSE NULL END;
  v_q_unaccent := CASE WHEN v_q IS NOT NULL THEN lower(public.unaccent(v_q)) ELSE NULL END;
  v_tribunal := NULLIF(regexp_replace(upper(COALESCE(p_tribunal, '')), '[^A-Z0-9]', '', 'g'), '');

  RETURN QUERY
  WITH base AS (
    SELECT
      ps.id, ps.id_djen, 'termo'::text AS tipo_origem, NULL::uuid AS processo_id,
      ps.processo_numero, ps.conteudo, ps.data_publicacao, ps.data_disponibilizacao,
      ps.fonte, ps.created_at, ps.monitoramento_id,
      md.termo_busca AS monitoramento_termo, md.descricao AS monitoramento_descricao,
      md.tipo AS monitoramento_tipo, md.oab AS monitoramento_oab, md.uf AS monitoramento_uf,
      COALESCE(ps.coordenacao_id, md.coordenacao_id) AS coordenacao_id,
      c.nome AS coordenacao_nome,
      ps.polo_ativo, ps.polo_passivo, ps.tribunal, ps.orgao, ps.tipo_comunicacao, ps.meio,
      ps.advogados_json, ps.partes_json,
      EXISTS (
        SELECT 1 FROM public.publicacoes_djen_leituras l
        WHERE l.publicacao_id = ps.id AND l.tabela_origem = 'termo' AND l.usuario_id = v_uid
      ) AS lida_por_user_row,
      CASE
        WHEN NULLIF(btrim(ps.id_djen), '') IS NOT NULL THEN 'id_djen|' || btrim(ps.id_djen)
        WHEN NULLIF(btrim(ps.dedup_key), '') IS NOT NULL THEN 'dedup|' || btrim(ps.dedup_key)
        ELSE 'row|' || ps.id::text
      END AS dedup_uid
    FROM public.publicacoes_djen ps
    LEFT JOIN public.monitoramentos_djen md ON md.id = ps.monitoramento_id
    LEFT JOIN public.coordenacoes c ON c.id = COALESCE(ps.coordenacao_id, md.coordenacao_id)
    WHERE (v_tipo IS NULL OR v_tipo IN ('termo', 'parte', 'djet-pautas', 'kurier'))
      AND (v_tipo IS DISTINCT FROM 'parte' OR lower(COALESCE(md.tipo, '')) = 'parte')
      AND (v_tipo IS DISTINCT FROM 'djet-pautas' OR ps.tipo_publicacao = 'pauta')
      AND (v_tipo IS DISTINCT FROM 'kurier' OR lower(COALESCE(ps.fonte, '')) = 'kurier')
      AND (v_tipo = 'djet-pautas' OR COALESCE(ps.tipo_publicacao, '') <> 'pauta')
      AND COALESCE(ps.fonte, '') <> 'dejt-pdf'
      AND (p_monitoramento_id IS NULL OR ps.monitoramento_id = p_monitoramento_id)
      AND (p_coordenacao_id IS NULL OR ps.coordenacao_id = p_coordenacao_id OR (ps.coordenacao_id IS NULL AND md.coordenacao_id = p_coordenacao_id))
      AND (v_is_admin OR EXISTS (SELECT 1 FROM public.membros_coordenacao mc WHERE mc.coordenacao_id = COALESCE(ps.coordenacao_id, md.coordenacao_id) AND mc.usuario_id = v_uid))
      AND ps.status IN ('encontrada','duplicada')
      AND (p_inicio IS NULL OR ps.created_at >= p_inicio)
      AND (p_fim IS NULL OR ps.created_at <= p_fim)
      AND (p_data_disponibilizacao_inicio IS NULL
        OR (v_tipo = 'djet-pautas' AND ps.data_disponibilizacao >= (((p_data_disponibilizacao_inicio AT TIME ZONE 'UTC')::date)::timestamp AT TIME ZONE 'UTC'))
        OR (v_tipo IS DISTINCT FROM 'djet-pautas' AND CASE
            WHEN lower(COALESCE(ps.fonte, '')) = 'kurier'
              THEN (ps.created_at AT TIME ZONE 'America/Sao_Paulo')::date >= (p_data_disponibilizacao_inicio AT TIME ZONE 'America/Sao_Paulo')::date
            ELSE ps.data_disponibilizacao >= p_data_disponibilizacao_inicio END))
      AND (p_data_disponibilizacao_fim IS NULL
        OR (v_tipo = 'djet-pautas' AND ps.data_disponibilizacao <= ((((p_data_disponibilizacao_fim AT TIME ZONE 'UTC')::date + 1)::timestamp AT TIME ZONE 'UTC') - interval '1 millisecond'))
        OR (v_tipo IS DISTINCT FROM 'djet-pautas' AND CASE
            WHEN lower(COALESCE(ps.fonte, '')) = 'kurier'
              THEN (ps.created_at AT TIME ZONE 'America/Sao_Paulo')::date <= (p_data_disponibilizacao_fim AT TIME ZONE 'America/Sao_Paulo')::date
            ELSE ps.data_disponibilizacao <= p_data_disponibilizacao_fim END))
      AND (v_tribunal IS NULL OR upper(COALESCE(ps.tribunal, ps.fonte, '')) ~ ('(^|[^A-Z0-9])' || v_tribunal || '([^A-Z0-9]|$)'))
      AND (
        v_q IS NULL
        OR ps.conteudo ILIKE ('%' || v_q || '%')
        OR ps.processo_numero ILIKE ('%' || v_q || '%')
        OR md.termo_busca ILIKE ('%' || v_q || '%')
        OR COALESCE(md.descricao, '') ILIKE ('%' || v_q || '%')
        OR COALESCE(ps.advogados_json::text, '') ILIKE ('%' || v_q || '%')
        OR (v_q_unaccent IS NOT NULL AND (
          lower(public.unaccent(COALESCE(ps.processo_numero, ''))) LIKE ('%' || v_q_unaccent || '%')
          OR lower(public.unaccent(COALESCE(md.termo_busca, ''))) LIKE ('%' || v_q_unaccent || '%')
          OR lower(public.unaccent(COALESCE(md.descricao, ''))) LIKE ('%' || v_q_unaccent || '%')
          OR lower(public.unaccent(COALESCE(ps.advogados_json::text, ''))) LIKE ('%' || v_q_unaccent || '%')
          OR lower(public.unaccent(COALESCE(ps.partes_json::text, ''))) LIKE ('%' || v_q_unaccent || '%')
          OR ((p_coordenacao_id IS NOT NULL OR p_data_disponibilizacao_inicio IS NOT NULL OR p_inicio IS NOT NULL)
              AND lower(public.unaccent(COALESCE(ps.conteudo, ''))) LIKE ('%' || v_q_unaccent || '%'))
        ))
        OR (v_q_cnj IS NOT NULL AND ps.conteudo ILIKE ('%' || v_q_cnj || '%'))
        OR (v_q_digits IS NOT NULL AND (
          regexp_replace(COALESCE(ps.processo_numero, ''), '[^0-9]', '', 'g') LIKE ('%' || v_q_digits || '%')
          OR ((p_coordenacao_id IS NOT NULL OR p_data_disponibilizacao_inicio IS NOT NULL OR p_inicio IS NOT NULL)
              AND regexp_replace(COALESCE(ps.conteudo, ''), '[^0-9]', '', 'g') LIKE ('%' || v_q_digits || '%'))
        ))
      )
  ),
  base_group AS (
    SELECT b.*,
      bool_or(b.lida_por_user_row) OVER (PARTITION BY b.coordenacao_id, b.dedup_uid) AS lida_por_user
    FROM base b
  ),
  read_filtered AS (
    SELECT b.* FROM base_group b
    WHERE v_read = 'todas' OR (v_read = 'nao_lidas' AND NOT b.lida_por_user) OR (v_read = 'lidas' AND b.lida_por_user)
  ),
  deduped AS (
    SELECT DISTINCT ON (rf.coordenacao_id, rf.dedup_uid) rf.*
    FROM read_filtered rf
    WHERE p_dedup = true
    ORDER BY rf.coordenacao_id, rf.dedup_uid, rf.lida_por_user_row DESC, rf.created_at DESC, rf.id ASC
  ),
  all_rows AS (
    SELECT rf.* FROM read_filtered rf WHERE p_dedup = false
    UNION ALL
    SELECT d.* FROM deduped d
  ),
  page_rows AS (
    SELECT ar.* FROM all_rows ar
    ORDER BY ar.created_at DESC, ar.id ASC
    LIMIT GREATEST(p_limit, 1) OFFSET GREATEST(p_offset, 0)
  ),
  page_group_ids AS (
    SELECT pr.id AS survivor_id, b.id AS variant_id
    FROM page_rows pr
    JOIN base b ON b.coordenacao_id = pr.coordenacao_id AND b.dedup_uid = pr.dedup_uid
  )
  SELECT
    pr.id, pr.id_djen, pr.tipo_origem, pr.processo_id, pr.processo_numero, pr.conteudo,
    pr.data_publicacao, pr.data_disponibilizacao, pr.fonte,
    pr.lida_por_user AS lida,
    pr.created_at, pr.monitoramento_id, pr.monitoramento_termo, pr.monitoramento_descricao,
    pr.monitoramento_tipo, pr.monitoramento_oab, pr.monitoramento_uf,
    pr.coordenacao_id, pr.coordenacao_nome, pr.polo_ativo, pr.polo_passivo,
    pr.tribunal, pr.orgao, pr.tipo_comunicacao, pr.meio, pr.advogados_json, pr.partes_json,
    COALESCE((
      SELECT jsonb_agg(DISTINCT jsonb_build_object('nome', COALESCE(l.usuario_nome, 'Desconhecido'), 'lida_em', l.lida_em))
      FROM public.publicacoes_djen_leituras l
      WHERE l.tabela_origem = 'termo'
        AND l.publicacao_id IN (SELECT pg.variant_id FROM page_group_ids pg WHERE pg.survivor_id = pr.id)
    ), '[]'::jsonb) AS lido_por
  FROM page_rows pr
  ORDER BY pr.created_at DESC, pr.id ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_djen_stats_servidor_per_user(uuid, timestamptz, timestamptz, text, text, uuid, timestamptz, timestamptz, text, boolean, boolean) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_djen_publicacoes_servidor_unificadas(uuid, timestamptz, timestamptz, text, integer, integer, uuid, text, text, timestamptz, timestamptz, text, boolean, boolean) TO authenticated, service_role;