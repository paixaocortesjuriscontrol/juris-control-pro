-- Corrige busca da Análise DJEN/Servidor:
-- 1) número de processo secundário dentro do teor do edital coletivo;
-- 2) busca por advogado sem depender de acento/caixa e incluindo advogados_json/descrição;
-- 3) totalizadores usando a mesma regra da listagem.

CREATE OR REPLACE FUNCTION public.get_djen_stats_per_user(
  p_coordenacao_id uuid DEFAULT NULL::uuid,
  p_inicio timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_fim timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_tipo_origem text DEFAULT NULL::text,
  p_search_query text DEFAULT NULL::text,
  p_monitoramento_id uuid DEFAULT NULL::uuid,
  p_data_disponibilizacao_inicio timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_data_disponibilizacao_fim timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_tribunal text DEFAULT NULL::text
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
SET statement_timeout TO '40s'
AS $function$
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
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not authenticated' USING ERRCODE = '28000'; END IF;
  v_is_admin := public.is_admin_or_coordenador(v_uid);
  IF p_coordenacao_id IS NOT NULL AND NOT v_is_admin
     AND NOT EXISTS (SELECT 1 FROM public.membros_coordenacao mc WHERE mc.coordenacao_id = p_coordenacao_id AND mc.usuario_id = v_uid)
  THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  v_tipo := lower(NULLIF(btrim(COALESCE(p_tipo_origem, '')), ''));
  IF v_tipo = 'todos' THEN v_tipo := NULL; END IF;
  v_q := NULLIF(btrim(COALESCE(p_search_query, '')), '');
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
      pd.id,
      'termo'::text AS tipo_origem,
      pd.created_at,
      COALESCE(md.coordenacao_id, pd.coordenacao_id) AS dedup_coord,
      COALESCE(
        public.compute_djen_conteudo_dedup_key(COALESCE(md.coordenacao_id, pd.coordenacao_id), pd.processo_numero, pd.data_disponibilizacao, pd.data_publicacao, pd.created_at, pd.conteudo),
        NULLIF(btrim(pd.id_djen), ''),
        concat_ws('|', 'legacy', pd.dedup_processo_digits, pd.dedup_data_ref::text, pd.dedup_head_norm),
        'row|termo|' || pd.id::text
      ) AS dedup_uid,
      CASE WHEN md.tipo = 'parte' THEN 0 ELSE 1 END AS prio,
      CASE WHEN pd.status = 'encontrada' THEN 0 ELSE 1 END AS status_prio,
      length(COALESCE(pd.conteudo, '')) AS conteudo_len,
      EXISTS (SELECT 1 FROM public.publicacoes_djen_leituras l WHERE l.publicacao_id = pd.id AND l.tabela_origem = 'termo' AND l.usuario_id = v_uid) AS lida_por_user
    FROM public.publicacoes_djen pd
    JOIN public.monitoramentos_djen md ON md.id = pd.monitoramento_id
    WHERE (p_coordenacao_id IS NULL OR COALESCE(md.coordenacao_id, pd.coordenacao_id) = p_coordenacao_id)
      AND (v_is_admin OR EXISTS (SELECT 1 FROM public.membros_coordenacao mc WHERE mc.coordenacao_id = COALESCE(md.coordenacao_id, pd.coordenacao_id) AND mc.usuario_id = v_uid))
      AND pd.status IN ('encontrada', 'duplicada')
      AND (v_tipo IS NULL OR v_tipo IN ('termo', 'parte', 'djet-pautas', 'kurier'))
      AND (v_tipo IS DISTINCT FROM 'parte' OR md.tipo = 'parte')
      AND (v_tipo = 'djet-pautas' OR COALESCE(pd.fonte, '') <> 'dejt-pdf')
      AND (v_tipo IS DISTINCT FROM 'djet-pautas' OR pd.fonte = 'dejt-pdf')
      AND (v_tipo IS DISTINCT FROM 'kurier' OR lower(COALESCE(pd.fonte, '')) = 'kurier')
      AND (p_monitoramento_id IS NULL OR pd.monitoramento_id = p_monitoramento_id)
      AND (p_inicio IS NULL OR pd.created_at >= p_inicio)
      AND (p_fim IS NULL OR pd.created_at <= p_fim)
      AND (p_data_disponibilizacao_inicio IS NULL OR CASE
            WHEN lower(COALESCE(pd.fonte,'')) = 'kurier'
              THEN (pd.created_at AT TIME ZONE 'America/Sao_Paulo')::date >= (p_data_disponibilizacao_inicio AT TIME ZONE 'America/Sao_Paulo')::date
            ELSE pd.data_disponibilizacao >= p_data_disponibilizacao_inicio END)
      AND (p_data_disponibilizacao_fim IS NULL OR CASE
            WHEN lower(COALESCE(pd.fonte,'')) = 'kurier'
              THEN (pd.created_at AT TIME ZONE 'America/Sao_Paulo')::date <= (p_data_disponibilizacao_fim AT TIME ZONE 'America/Sao_Paulo')::date
            ELSE pd.data_disponibilizacao <= p_data_disponibilizacao_fim END)
      AND (v_tribunal IS NULL OR upper(COALESCE(pd.tribunal, pd.fonte, '')) ~ ('(^|[^A-Z0-9])' || v_tribunal || '([^A-Z0-9]|$)'))
      AND (
        v_q IS NULL
        OR pd.processo_numero ILIKE ('%' || v_q || '%')
        OR md.termo_busca ILIKE ('%' || v_q || '%')
        OR COALESCE(md.descricao, '') ILIKE ('%' || v_q || '%')
        OR COALESCE(pd.advogados_json::text, '') ILIKE ('%' || v_q || '%')
        OR pd.conteudo ILIKE ('%' || v_q || '%')
        OR (v_q_unaccent IS NOT NULL AND (
          lower(public.unaccent(COALESCE(pd.processo_numero, ''))) LIKE ('%' || v_q_unaccent || '%')
          OR lower(public.unaccent(COALESCE(md.termo_busca, ''))) LIKE ('%' || v_q_unaccent || '%')
          OR lower(public.unaccent(COALESCE(md.descricao, ''))) LIKE ('%' || v_q_unaccent || '%')
          OR lower(public.unaccent(COALESCE(pd.advogados_json::text, ''))) LIKE ('%' || v_q_unaccent || '%')
          OR lower(public.unaccent(COALESCE(pd.partes_json::text, ''))) LIKE ('%' || v_q_unaccent || '%')
          OR ((p_coordenacao_id IS NOT NULL OR p_data_disponibilizacao_inicio IS NOT NULL OR p_inicio IS NOT NULL)
              AND lower(public.unaccent(COALESCE(pd.conteudo, ''))) LIKE ('%' || v_q_unaccent || '%'))
        ))
        OR (v_q_cnj IS NOT NULL AND pd.conteudo ILIKE ('%' || v_q_cnj || '%'))
        OR (v_q_digits IS NOT NULL AND (
          regexp_replace(COALESCE(pd.processo_numero, ''), '[^0-9]', '', 'g') LIKE ('%' || v_q_digits || '%')
          OR ((p_coordenacao_id IS NOT NULL OR p_data_disponibilizacao_inicio IS NOT NULL OR p_inicio IS NOT NULL)
              AND regexp_replace(COALESCE(pd.conteudo, ''), '[^0-9]', '', 'g') LIKE ('%' || v_q_digits || '%'))
        ))
      )
    UNION ALL
    SELECT
      pdp.id,
      'processo'::text AS tipo_origem,
      pdp.created_at,
      pdp.coordenacao_id AS dedup_coord,
      COALESCE(
        public.compute_djen_conteudo_dedup_key(pdp.coordenacao_id, pdp.processo_numero, pdp.data_disponibilizacao, pdp.data_publicacao, pdp.created_at, pdp.conteudo),
        NULLIF(btrim(pdp.id_djen), ''),
        concat_ws('|', 'legacy', pdp.dedup_processo_digits, pdp.dedup_data_ref::text, pdp.dedup_head_norm),
        'row|processo|' || pdp.id::text
      ) AS dedup_uid,
      2 AS prio,
      CASE WHEN pdp.status = 'encontrada' THEN 0 ELSE 1 END AS status_prio,
      length(COALESCE(pdp.conteudo, '')) AS conteudo_len,
      EXISTS (SELECT 1 FROM public.publicacoes_djen_leituras l WHERE l.publicacao_id = pdp.id AND l.tabela_origem = 'processo' AND l.usuario_id = v_uid) AS lida_por_user
    FROM public.publicacoes_djen_processos pdp
    LEFT JOIN public.processos pr ON pr.id = pdp.processo_id
    WHERE (p_coordenacao_id IS NULL OR pdp.coordenacao_id = p_coordenacao_id)
      AND (v_is_admin OR EXISTS (SELECT 1 FROM public.membros_coordenacao mc WHERE mc.coordenacao_id = pdp.coordenacao_id AND mc.usuario_id = v_uid))
      AND pdp.status IN ('encontrada', 'duplicada')
      AND (v_tipo IS NULL OR v_tipo = 'processo' OR v_tipo = 'kurier')
      AND (v_tipo IS DISTINCT FROM 'kurier' OR lower(COALESCE(pdp.fonte, '')) = 'kurier')
      AND p_monitoramento_id IS NULL
      AND (p_inicio IS NULL OR pdp.created_at >= p_inicio)
      AND (p_fim IS NULL OR pdp.created_at <= p_fim)
      AND (p_data_disponibilizacao_inicio IS NULL OR CASE
            WHEN lower(COALESCE(pdp.fonte,'')) = 'kurier'
              THEN (pdp.created_at AT TIME ZONE 'America/Sao_Paulo')::date >= (p_data_disponibilizacao_inicio AT TIME ZONE 'America/Sao_Paulo')::date
            ELSE pdp.data_disponibilizacao >= p_data_disponibilizacao_inicio END)
      AND (p_data_disponibilizacao_fim IS NULL OR CASE
            WHEN lower(COALESCE(pdp.fonte,'')) = 'kurier'
              THEN (pdp.created_at AT TIME ZONE 'America/Sao_Paulo')::date <= (p_data_disponibilizacao_fim AT TIME ZONE 'America/Sao_Paulo')::date
            ELSE pdp.data_disponibilizacao <= p_data_disponibilizacao_fim END)
      AND (v_tribunal IS NULL OR upper(COALESCE(pdp.tribunal, pdp.fonte, '')) ~ ('(^|[^A-Z0-9])' || v_tribunal || '([^A-Z0-9]|$)'))
      AND (
        v_q IS NULL
        OR pdp.processo_numero ILIKE ('%' || v_q || '%')
        OR pdp.conteudo ILIKE ('%' || v_q || '%')
        OR COALESCE(pr.polo_ativo, '') ILIKE ('%' || v_q || '%')
        OR COALESCE(pr.polo_passivo, '') ILIKE ('%' || v_q || '%')
        OR COALESCE(pdp.advogados_json::text, '') ILIKE ('%' || v_q || '%')
        OR (v_q_unaccent IS NOT NULL AND (
          lower(public.unaccent(COALESCE(pdp.processo_numero, ''))) LIKE ('%' || v_q_unaccent || '%')
          OR lower(public.unaccent(COALESCE(pr.polo_ativo, ''))) LIKE ('%' || v_q_unaccent || '%')
          OR lower(public.unaccent(COALESCE(pr.polo_passivo, ''))) LIKE ('%' || v_q_unaccent || '%')
          OR lower(public.unaccent(COALESCE(pdp.advogados_json::text, ''))) LIKE ('%' || v_q_unaccent || '%')
          OR lower(public.unaccent(COALESCE(pdp.partes_json::text, ''))) LIKE ('%' || v_q_unaccent || '%')
          OR ((p_coordenacao_id IS NOT NULL OR p_data_disponibilizacao_inicio IS NOT NULL OR p_inicio IS NOT NULL)
              AND lower(public.unaccent(COALESCE(pdp.conteudo, ''))) LIKE ('%' || v_q_unaccent || '%'))
        ))
        OR (v_q_cnj IS NOT NULL AND pdp.conteudo ILIKE ('%' || v_q_cnj || '%'))
        OR (v_q_digits IS NOT NULL AND (
          regexp_replace(COALESCE(pdp.processo_numero, ''), '[^0-9]', '', 'g') LIKE ('%' || v_q_digits || '%')
          OR ((p_coordenacao_id IS NOT NULL OR p_data_disponibilizacao_inicio IS NOT NULL OR p_inicio IS NOT NULL)
              AND regexp_replace(COALESCE(pdp.conteudo, ''), '[^0-9]', '', 'g') LIKE ('%' || v_q_digits || '%'))
        ))
      )
  ),
  ranked AS (
    SELECT DISTINCT ON (b.dedup_coord, b.dedup_uid)
      b.id, b.tipo_origem, b.lida_por_user
    FROM base b
    ORDER BY b.dedup_coord, b.dedup_uid, b.status_prio, b.prio, b.conteudo_len DESC, b.created_at DESC, b.id DESC
  ),
  bruto AS (
    SELECT
      COUNT(*) FILTER (WHERE b.tipo_origem = 'termo')::bigint AS total_termos,
      COUNT(*) FILTER (WHERE b.tipo_origem = 'processo')::bigint AS total_processos,
      COUNT(*) FILTER (WHERE b.tipo_origem = 'termo' AND NOT b.lida_por_user)::bigint AS nao_lidas_termos,
      COUNT(*) FILTER (WHERE b.tipo_origem = 'processo' AND NOT b.lida_por_user)::bigint AS nao_lidas_processos,
      COUNT(*)::bigint AS total_bruto
    FROM base b
  ),
  unicas AS (
    SELECT
      COUNT(*)::bigint AS total_unicas,
      COUNT(*) FILTER (WHERE NOT r.lida_por_user)::bigint AS nao_lidas_unicas
    FROM ranked r
  )
  SELECT bruto.total_termos, bruto.total_processos, bruto.nao_lidas_termos, bruto.nao_lidas_processos,
         unicas.total_unicas, unicas.nao_lidas_unicas, bruto.total_bruto
  FROM bruto CROSS JOIN unicas;
END;
$function$;


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
            WHEN lower(COALESCE(ps.fonte, ps.origem, '')) = 'kurier'
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
            WHEN lower(COALESCE(ps.fonte, ps.origem, '')) = 'kurier'
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
$function$;
-- ================== SERVIDOR ==================
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
AS $function$
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
    FROM public.publicacoes_djen_servidor ps
    LEFT JOIN public.monitoramentos_djen md ON md.id = ps.monitoramento_id
    LEFT JOIN public.coordenacoes c ON c.id = COALESCE(ps.coordenacao_id, md.coordenacao_id)
    WHERE (v_tipo IS NULL OR v_tipo IN ('termo', 'parte', 'djet-pautas', 'kurier'))
      AND (v_tipo IS DISTINCT FROM 'parte' OR lower(COALESCE(md.tipo, '')) = 'parte')
      AND (v_tipo IS DISTINCT FROM 'djet-pautas' OR ps.tipo_publicacao = 'pauta')
      AND (v_tipo IS DISTINCT FROM 'kurier' OR lower(COALESCE(ps.fonte, ps.origem, '')) = 'kurier')
      AND (v_tipo = 'djet-pautas' OR COALESCE(ps.tipo_publicacao, '') <> 'pauta')
      AND (p_monitoramento_id IS NULL OR ps.monitoramento_id = p_monitoramento_id)
      AND (p_coordenacao_id IS NULL OR ps.coordenacao_id = p_coordenacao_id OR (ps.coordenacao_id IS NULL AND md.coordenacao_id = p_coordenacao_id))
      AND (v_is_admin OR EXISTS (SELECT 1 FROM public.membros_coordenacao mc WHERE mc.coordenacao_id = COALESCE(ps.coordenacao_id, md.coordenacao_id) AND mc.usuario_id = v_uid))
      AND (p_inicio IS NULL OR ps.created_at >= p_inicio)
      AND (p_fim IS NULL OR ps.created_at <= p_fim)
      AND (p_data_disponibilizacao_inicio IS NULL
        OR (v_tipo = 'djet-pautas' AND ps.data_disponibilizacao >= (((p_data_disponibilizacao_inicio AT TIME ZONE 'UTC')::date)::timestamp AT TIME ZONE 'UTC'))
        OR (v_tipo IS DISTINCT FROM 'djet-pautas' AND CASE
            WHEN lower(COALESCE(ps.fonte, ps.origem, '')) = 'kurier'
              THEN (ps.created_at AT TIME ZONE 'America/Sao_Paulo')::date >= (p_data_disponibilizacao_inicio AT TIME ZONE 'America/Sao_Paulo')::date
            ELSE ps.data_disponibilizacao >= p_data_disponibilizacao_inicio END))
      AND (p_data_disponibilizacao_fim IS NULL
        OR (v_tipo = 'djet-pautas' AND ps.data_disponibilizacao <= ((((p_data_disponibilizacao_fim AT TIME ZONE 'UTC')::date + 1)::timestamp AT TIME ZONE 'UTC') - interval '1 millisecond'))
        OR (v_tipo IS DISTINCT FROM 'djet-pautas' AND CASE
            WHEN lower(COALESCE(ps.fonte, ps.origem, '')) = 'kurier'
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
    -- Propaga a leitura para todo o grupo (coord + dedup_uid)
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
    -- Prefere o registro que o próprio usuário marcou; senão o mais recente
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
    -- Coleta todos os ids de todas as variantes do mesmo grupo (para agregar leituras)
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
$function$;

-- ================== BROWSER ==================
CREATE OR REPLACE FUNCTION public.get_djen_publicacoes_unificadas(
  p_coordenacao_id uuid DEFAULT NULL,
  p_inicio timestamptz DEFAULT NULL,
  p_fim timestamptz DEFAULT NULL,
  p_apenas_nao_lidas boolean DEFAULT false,
  p_search_query text DEFAULT NULL,
  p_limit integer DEFAULT 500,
  p_offset integer DEFAULT 0,
  p_monitoramento_id uuid DEFAULT NULL,
  p_tipo_origem text DEFAULT NULL,
  p_read_status text DEFAULT 'todas',
  p_data_disponibilizacao_inicio timestamptz DEFAULT NULL,
  p_data_disponibilizacao_fim timestamptz DEFAULT NULL,
  p_tribunal text DEFAULT NULL,
  p_dedup boolean DEFAULT false
)
RETURNS TABLE(id uuid, tipo_origem text, processo_id uuid, processo_numero text, conteudo text, data_publicacao timestamptz, data_disponibilizacao timestamptz, fonte text, lida boolean, created_at timestamptz, monitoramento_id uuid, monitoramento_termo text, monitoramento_descricao text, monitoramento_tipo text, monitoramento_oab text, monitoramento_uf text, coordenacao_id uuid, coordenacao_nome text, polo_ativo text, polo_passivo text, tribunal text, orgao text, tipo_comunicacao text, meio text, advogados_json jsonb, partes_json jsonb, lido_por jsonb)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' SET statement_timeout TO '20s'
AS $function$
DECLARE
  v_uid uuid; v_q text; v_q_digits text; v_q_cnj text; v_q_unaccent text; v_tipo text; v_read text;
  v_is_admin boolean; v_tribunal text;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not authenticated' USING ERRCODE='28000'; END IF;
  v_is_admin := public.is_admin_or_coordenador(v_uid);
  IF p_coordenacao_id IS NOT NULL AND NOT v_is_admin
     AND NOT EXISTS (SELECT 1 FROM public.membros_coordenacao mc WHERE mc.coordenacao_id = p_coordenacao_id AND mc.usuario_id = v_uid)
  THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;

  v_tipo := lower(NULLIF(btrim(COALESCE(p_tipo_origem, '')), ''));
  IF v_tipo = 'todos' THEN v_tipo := NULL; END IF;
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
    SELECT pd.id, 'termo'::text AS tipo_origem, NULL::uuid AS processo_id,
      pd.processo_numero, pd.conteudo, pd.data_publicacao, pd.data_disponibilizacao,
      pd.fonte, pd.lida, pd.created_at, pd.monitoramento_id,
      md.termo_busca, md.descricao AS monitoramento_descricao,
      md.tipo AS monitoramento_tipo, md.oab AS monitoramento_oab, md.uf AS monitoramento_uf,
      COALESCE(pd.coordenacao_id, md.coordenacao_id) AS coordenacao_id,
      c.nome AS coordenacao_nome,
      pd.polo_ativo, pd.polo_passivo, pd.tribunal, pd.orgao, pd.tipo_comunicacao, pd.meio,
      pd.advogados_json, pd.partes_json,
      COALESCE(pd.coordenacao_id, md.coordenacao_id) AS dedup_coord,
      COALESCE(
        public.compute_djen_conteudo_dedup_key(
          COALESCE(md.coordenacao_id, pd.coordenacao_id),
          pd.processo_numero, pd.data_disponibilizacao, pd.data_publicacao, pd.created_at, pd.conteudo
        ),
        NULLIF(btrim(pd.id_djen), ''),
        'row|termo|' || pd.id::text
      ) AS dedup_uid,
      CASE WHEN md.tipo = 'parte' THEN 0 ELSE 1 END AS prio,
      CASE WHEN pd.status = 'encontrada' THEN 0 ELSE 1 END AS status_prio,
      EXISTS (SELECT 1 FROM public.publicacoes_djen_leituras l WHERE l.publicacao_id=pd.id AND l.tabela_origem='termo' AND l.usuario_id=v_uid) AS lida_por_user_row
    FROM public.publicacoes_djen pd
    JOIN public.monitoramentos_djen md ON md.id = pd.monitoramento_id
    LEFT JOIN public.coordenacoes c ON c.id = COALESCE(pd.coordenacao_id, md.coordenacao_id)
    WHERE (p_coordenacao_id IS NULL OR pd.coordenacao_id = p_coordenacao_id OR (pd.coordenacao_id IS NULL AND md.coordenacao_id = p_coordenacao_id))
      AND (v_is_admin OR EXISTS (SELECT 1 FROM public.membros_coordenacao mc WHERE mc.coordenacao_id = COALESCE(pd.coordenacao_id, md.coordenacao_id) AND mc.usuario_id = v_uid))
      AND pd.status IN ('encontrada','duplicada')
      AND (v_tipo IS NULL OR v_tipo IN ('termo','parte','kurier'))
      AND (v_tipo IS DISTINCT FROM 'parte' OR md.tipo = 'parte')
      AND (v_tipo IS DISTINCT FROM 'kurier' OR lower(COALESCE(pd.fonte,'')) = 'kurier')
      AND COALESCE(pd.fonte, '') <> 'dejt-pdf'
      AND (p_monitoramento_id IS NULL OR pd.monitoramento_id = p_monitoramento_id)
      AND (p_inicio IS NULL OR pd.created_at >= p_inicio)
      AND (p_fim IS NULL OR pd.created_at <= p_fim)
      AND (p_data_disponibilizacao_inicio IS NULL OR CASE
            WHEN lower(COALESCE(pd.fonte,'')) = 'kurier'
              THEN (pd.created_at AT TIME ZONE 'America/Sao_Paulo')::date >= (p_data_disponibilizacao_inicio AT TIME ZONE 'America/Sao_Paulo')::date
            ELSE pd.data_disponibilizacao >= p_data_disponibilizacao_inicio END)
      AND (p_data_disponibilizacao_fim IS NULL OR CASE
            WHEN lower(COALESCE(pd.fonte,'')) = 'kurier'
              THEN (pd.created_at AT TIME ZONE 'America/Sao_Paulo')::date <= (p_data_disponibilizacao_fim AT TIME ZONE 'America/Sao_Paulo')::date
            ELSE pd.data_disponibilizacao <= p_data_disponibilizacao_fim END)
      AND (v_tribunal IS NULL OR upper(COALESCE(pd.tribunal, pd.fonte, '')) ~ ('(^|[^A-Z0-9])' || v_tribunal || '([^A-Z0-9]|$)'))
      AND (
        v_q IS NULL
        OR pd.conteudo ILIKE ('%'||v_q||'%')
        OR pd.processo_numero ILIKE ('%'||v_q||'%')
        OR md.termo_busca ILIKE ('%'||v_q||'%')
        OR COALESCE(md.descricao, '') ILIKE ('%'||v_q||'%')
        OR COALESCE(pd.advogados_json::text, '') ILIKE ('%'||v_q||'%')
        OR (v_q_unaccent IS NOT NULL AND (
          lower(public.unaccent(COALESCE(pd.processo_numero, ''))) LIKE ('%'||v_q_unaccent||'%')
          OR lower(public.unaccent(COALESCE(md.termo_busca, ''))) LIKE ('%'||v_q_unaccent||'%')
          OR lower(public.unaccent(COALESCE(md.descricao, ''))) LIKE ('%'||v_q_unaccent||'%')
          OR lower(public.unaccent(COALESCE(pd.advogados_json::text, ''))) LIKE ('%'||v_q_unaccent||'%')
          OR lower(public.unaccent(COALESCE(pd.partes_json::text, ''))) LIKE ('%'||v_q_unaccent||'%')
          OR ((p_coordenacao_id IS NOT NULL OR p_data_disponibilizacao_inicio IS NOT NULL OR p_inicio IS NOT NULL)
              AND lower(public.unaccent(COALESCE(pd.conteudo, ''))) LIKE ('%'||v_q_unaccent||'%'))
        ))
        OR (v_q_cnj IS NOT NULL AND pd.conteudo ILIKE ('%'||v_q_cnj||'%'))
        OR (v_q_digits IS NOT NULL AND (
          regexp_replace(COALESCE(pd.processo_numero,''),'[^0-9]','','g') LIKE ('%'||v_q_digits||'%')
          OR ((p_coordenacao_id IS NOT NULL OR p_data_disponibilizacao_inicio IS NOT NULL OR p_inicio IS NOT NULL)
              AND regexp_replace(COALESCE(pd.conteudo,''),'[^0-9]','','g') LIKE ('%'||v_q_digits||'%'))
        ))
      )
    UNION ALL
    SELECT pdp.id, 'processo'::text, pdp.processo_id, pdp.processo_numero, pdp.conteudo,
      pdp.data_publicacao, pdp.data_disponibilizacao, pdp.fonte, pdp.lida, pdp.created_at,
      NULL::uuid, NULL::text, NULL::text, NULL::text, NULL::text, NULL::text,
      pdp.coordenacao_id, c2.nome,
      p.polo_ativo, p.polo_passivo, pdp.tribunal, pdp.orgao, pdp.tipo_comunicacao, pdp.meio,
      pdp.advogados_json, pdp.partes_json,
      pdp.coordenacao_id,
      COALESCE(
        public.compute_djen_conteudo_dedup_key(
          pdp.coordenacao_id, pdp.processo_numero, pdp.data_disponibilizacao, pdp.data_publicacao, pdp.created_at, pdp.conteudo
        ),
        NULLIF(btrim(pdp.id_djen), ''),
        'row|processo|' || pdp.id::text
      ),
      2, CASE WHEN pdp.status = 'encontrada' THEN 0 ELSE 1 END,
      EXISTS (SELECT 1 FROM public.publicacoes_djen_leituras l WHERE l.publicacao_id=pdp.id AND l.tabela_origem='processo' AND l.usuario_id=v_uid)
    FROM public.publicacoes_djen_processos pdp
    JOIN public.processos p ON p.id = pdp.processo_id
    JOIN public.coordenacoes c2 ON c2.id = pdp.coordenacao_id
    WHERE (p_coordenacao_id IS NULL OR pdp.coordenacao_id = p_coordenacao_id)
      AND (v_is_admin OR EXISTS (SELECT 1 FROM public.membros_coordenacao mc WHERE mc.coordenacao_id = pdp.coordenacao_id AND mc.usuario_id = v_uid))
      AND pdp.status IN ('encontrada','duplicada')
      AND (v_tipo IS NULL OR v_tipo = 'processo' OR v_tipo = 'kurier')
      AND (v_tipo IS DISTINCT FROM 'kurier' OR lower(COALESCE(pdp.fonte,'')) = 'kurier')
      AND p_monitoramento_id IS NULL
      AND (p_inicio IS NULL OR pdp.created_at >= p_inicio)
      AND (p_fim IS NULL OR pdp.created_at <= p_fim)
      AND (p_data_disponibilizacao_inicio IS NULL OR CASE
            WHEN lower(COALESCE(pdp.fonte,'')) = 'kurier'
              THEN (pdp.created_at AT TIME ZONE 'America/Sao_Paulo')::date >= (p_data_disponibilizacao_inicio AT TIME ZONE 'America/Sao_Paulo')::date
            ELSE pdp.data_disponibilizacao >= p_data_disponibilizacao_inicio END)
      AND (p_data_disponibilizacao_fim IS NULL OR CASE
            WHEN lower(COALESCE(pdp.fonte,'')) = 'kurier'
              THEN (pdp.created_at AT TIME ZONE 'America/Sao_Paulo')::date <= (p_data_disponibilizacao_fim AT TIME ZONE 'America/Sao_Paulo')::date
            ELSE pdp.data_disponibilizacao <= p_data_disponibilizacao_fim END)
      AND (v_tribunal IS NULL OR upper(COALESCE(pdp.tribunal, pdp.fonte, '')) ~ ('(^|[^A-Z0-9])' || v_tribunal || '([^A-Z0-9]|$)'))
      AND (
        v_q IS NULL
        OR pdp.conteudo ILIKE ('%'||v_q||'%')
        OR pdp.processo_numero ILIKE ('%'||v_q||'%')
        OR COALESCE(p.polo_ativo,'') ILIKE ('%'||v_q||'%')
        OR COALESCE(p.polo_passivo,'') ILIKE ('%'||v_q||'%')
        OR COALESCE(pdp.advogados_json::text, '') ILIKE ('%'||v_q||'%')
        OR (v_q_unaccent IS NOT NULL AND (
          lower(public.unaccent(COALESCE(pdp.processo_numero, ''))) LIKE ('%'||v_q_unaccent||'%')
          OR lower(public.unaccent(COALESCE(p.polo_ativo, ''))) LIKE ('%'||v_q_unaccent||'%')
          OR lower(public.unaccent(COALESCE(p.polo_passivo, ''))) LIKE ('%'||v_q_unaccent||'%')
          OR lower(public.unaccent(COALESCE(pdp.advogados_json::text, ''))) LIKE ('%'||v_q_unaccent||'%')
          OR lower(public.unaccent(COALESCE(pdp.partes_json::text, ''))) LIKE ('%'||v_q_unaccent||'%')
          OR ((p_coordenacao_id IS NOT NULL OR p_data_disponibilizacao_inicio IS NOT NULL OR p_inicio IS NOT NULL)
              AND lower(public.unaccent(COALESCE(pdp.conteudo, ''))) LIKE ('%'||v_q_unaccent||'%'))
        ))
        OR (v_q_cnj IS NOT NULL AND pdp.conteudo ILIKE ('%'||v_q_cnj||'%'))
        OR (v_q_digits IS NOT NULL AND (
          regexp_replace(COALESCE(pdp.processo_numero,''),'[^0-9]','','g') LIKE ('%'||v_q_digits||'%')
          OR ((p_coordenacao_id IS NOT NULL OR p_data_disponibilizacao_inicio IS NOT NULL OR p_inicio IS NOT NULL)
              AND regexp_replace(COALESCE(pdp.conteudo,''),'[^0-9]','','g') LIKE ('%'||v_q_digits||'%'))
        ))
      )
  ),
  base_group AS (
    SELECT b.*,
      bool_or(b.lida_por_user_row) OVER (PARTITION BY b.dedup_coord, b.dedup_uid) AS lida_por_user
    FROM base b
  ),
  ranked AS (
    SELECT DISTINCT ON (b.dedup_coord, b.dedup_uid) b.*
    FROM base_group b
    WHERE p_dedup = true
    ORDER BY b.dedup_coord, b.dedup_uid, b.lida_por_user_row DESC, b.status_prio, b.prio, b.created_at DESC, b.id DESC
  ),
  all_rows AS (
    SELECT b.* FROM base_group b WHERE p_dedup = false
    UNION ALL
    SELECT r.* FROM ranked r
  ),
  filtered AS (
    SELECT a.* FROM all_rows a
    WHERE (NOT p_apenas_nao_lidas OR NOT a.lida_por_user)
      AND (v_read='todas' OR (v_read='nao_lidas' AND NOT a.lida_por_user) OR (v_read='lidas' AND a.lida_por_user))
  ),
  final_rows AS (
    SELECT f.* FROM filtered f
    ORDER BY f.created_at DESC LIMIT GREATEST(p_limit,1) OFFSET GREATEST(p_offset,0)
  ),
  page_group_ids AS (
    SELECT fr.id AS survivor_id, fr.tipo_origem AS survivor_tipo, b.id AS variant_id, b.tipo_origem AS variant_tipo
    FROM final_rows fr
    JOIN base b ON b.dedup_coord = fr.dedup_coord AND b.dedup_uid = fr.dedup_uid
  )
  SELECT f.id, f.tipo_origem, f.processo_id, f.processo_numero, f.conteudo,
    f.data_publicacao, f.data_disponibilizacao, f.fonte, f.lida_por_user, f.created_at,
    f.monitoramento_id, f.termo_busca, f.monitoramento_descricao, f.monitoramento_tipo,
    f.monitoramento_oab, f.monitoramento_uf, f.coordenacao_id, f.coordenacao_nome,
    f.polo_ativo, f.polo_passivo, f.tribunal, f.orgao, f.tipo_comunicacao, f.meio,
    f.advogados_json, f.partes_json,
    COALESCE((
      SELECT jsonb_agg(DISTINCT jsonb_build_object('nome',COALESCE(l.usuario_nome,'Desconhecido'),'lida_em',l.lida_em))
      FROM public.publicacoes_djen_leituras l
      WHERE (l.publicacao_id, l.tabela_origem) IN (
        SELECT pg.variant_id, pg.variant_tipo FROM page_group_ids pg WHERE pg.survivor_id = f.id AND pg.survivor_tipo = f.tipo_origem
      )
    ),'[]'::jsonb)
  FROM final_rows f ORDER BY f.created_at DESC;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_djen_publicacoes_servidor_unificadas(uuid, timestamptz, timestamptz, text, integer, integer, uuid, text, text, timestamptz, timestamptz, text, boolean, boolean) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_djen_publicacoes_unificadas(uuid, timestamptz, timestamptz, boolean, text, integer, integer, uuid, text, text, timestamptz, timestamptz, text, boolean) TO authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.get_djen_stats_per_user(uuid, timestamptz, timestamptz, text, text, uuid, timestamptz, timestamptz, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_djen_stats_servidor_per_user(uuid, timestamptz, timestamptz, text, text, uuid, timestamptz, timestamptz, text, boolean, boolean) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_djen_publicacoes_servidor_unificadas(uuid, timestamptz, timestamptz, text, integer, integer, uuid, text, text, timestamptz, timestamptz, text, boolean, boolean) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_djen_publicacoes_unificadas(uuid, timestamptz, timestamptz, boolean, text, integer, integer, uuid, text, text, timestamptz, timestamptz, text, boolean) TO authenticated, service_role;
