CREATE OR REPLACE FUNCTION public.djen_strip_destinatarios(p_text text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN p_text IS NULL THEN ''
    ELSE regexp_replace(
      p_text,
      '(?is)(Destinat[aá]rio|Intimad[ao]|Advogad[ao]|Parte|Reclamante|Reclamad[ao]|Autor|R[eé]u|Requerente|Requerid[ao])[[:space:]]*(\([sS]\))?[[:space:]]*:.*$',
      '',
      'g'
    )
  END;
$function$;

CREATE OR REPLACE FUNCTION public.djen_normalize_conteudo_sem_destinatarios(p_text text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $function$
  SELECT lower(
    btrim(
      regexp_replace(
        regexp_replace(
          regexp_replace(public.djen_strip_destinatarios(COALESCE(p_text, '')), '<[^>]*>', ' ', 'g'),
          '[^[:alnum:][:space:]]+',
          ' ',
          'g'
        ),
        '[[:space:]]+',
        ' ',
        'g'
      )
    )
  );
$function$;

CREATE OR REPLACE FUNCTION public.compute_djen_conteudo_dedup_key(
  p_coordenacao uuid,
  p_processo_numero text,
  p_data_disp timestamp with time zone,
  p_data_pub timestamp with time zone,
  p_created_at timestamp with time zone,
  p_conteudo text
)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $function$
DECLARE
  v_digits text;
  v_data date;
  v_norm text;
BEGIN
  v_digits := regexp_replace(COALESCE(p_processo_numero, ''), '[^0-9]', '', 'g');
  IF v_digits = '' THEN
    RETURN NULL;
  END IF;
  v_data := COALESCE(p_data_disp::date, p_data_pub::date, p_created_at::date);
  IF v_data IS NULL THEN
    RETURN NULL;
  END IF;
  v_norm := left(public.djen_normalize_conteudo_sem_destinatarios(p_conteudo), 400);
  IF v_norm = '' THEN
    RETURN NULL;
  END IF;
  RETURN COALESCE(p_coordenacao::text, 'sem_coord') || '|' || v_digits || '|' || v_data::text || '|' || md5(v_norm);
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_djen_publicacoes_unificadas(
  p_coordenacao_id uuid DEFAULT NULL,
  p_inicio timestamp with time zone DEFAULT NULL,
  p_fim timestamp with time zone DEFAULT NULL,
  p_apenas_nao_lidas boolean DEFAULT false,
  p_search_query text DEFAULT NULL,
  p_limit integer DEFAULT 500,
  p_offset integer DEFAULT 0,
  p_monitoramento_id uuid DEFAULT NULL,
  p_tipo_origem text DEFAULT NULL,
  p_read_status text DEFAULT 'todas',
  p_data_disponibilizacao_inicio timestamp with time zone DEFAULT NULL,
  p_data_disponibilizacao_fim timestamp with time zone DEFAULT NULL,
  p_tribunal text DEFAULT NULL
)
RETURNS TABLE(
  id uuid, tipo_origem text, processo_id uuid, processo_numero text, conteudo text,
  data_publicacao timestamp with time zone, data_disponibilizacao timestamp with time zone,
  fonte text, lida boolean, created_at timestamp with time zone,
  monitoramento_id uuid, monitoramento_termo text, monitoramento_descricao text,
  monitoramento_tipo text, monitoramento_oab text, monitoramento_uf text,
  coordenacao_id uuid, coordenacao_nome text,
  polo_ativo text, polo_passivo text, tribunal text, orgao text,
  tipo_comunicacao text, meio text,
  advogados_json jsonb, partes_json jsonb, lido_por jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid; v_q text; v_q_digits text; v_tipo text; v_read text; v_is_admin boolean; v_tribunal text;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not authenticated' USING ERRCODE = '28000'; END IF;
  v_is_admin := public.is_admin_or_coordenador(v_uid);
  IF p_coordenacao_id IS NOT NULL AND NOT v_is_admin
     AND NOT EXISTS (SELECT 1 FROM public.membros_coordenacao mc WHERE mc.coordenacao_id = p_coordenacao_id AND mc.usuario_id = v_uid)
  THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  v_tipo := NULLIF(btrim(COALESCE(p_tipo_origem, '')), '');
  IF v_tipo = 'todos' THEN v_tipo := NULL; END IF;
  v_read := COALESCE(NULLIF(btrim(p_read_status), ''), 'todas');
  v_q := NULLIF(btrim(p_search_query), '');
  v_q_digits := CASE WHEN v_q IS NOT NULL THEN regexp_replace(v_q, '[^0-9]', '', 'g') ELSE NULL END;
  IF v_q_digits IS NOT NULL AND length(v_q_digits) < 5 THEN v_q_digits := NULL; END IF;
  v_tribunal := NULLIF(regexp_replace(upper(COALESCE(p_tribunal, '')), '[^A-Z0-9]', '', 'g'), '');

  RETURN QUERY
  WITH base AS (
    SELECT pd.id, 'termo'::text AS tipo_origem, NULL::uuid AS processo_id,
      pd.processo_numero, pd.conteudo, pd.data_publicacao, pd.data_disponibilizacao,
      pd.fonte, pd.lida, pd.created_at, pd.monitoramento_id,
      md.termo_busca AS monitoramento_termo, md.descricao AS monitoramento_descricao,
      md.tipo AS monitoramento_tipo, md.oab AS monitoramento_oab, md.uf AS monitoramento_uf,
      COALESCE(pd.coordenacao_id, md.coordenacao_id) AS coordenacao_id,
      c.nome AS coordenacao_nome,
      pd.polo_ativo, pd.polo_passivo, pd.tribunal, pd.orgao, pd.tipo_comunicacao, pd.meio,
      pd.advogados_json, pd.partes_json,
      COALESCE(pd.coordenacao_id, md.coordenacao_id) AS dedup_coord,
      COALESCE(
        public.compute_djen_conteudo_dedup_key(COALESCE(pd.coordenacao_id, md.coordenacao_id), pd.processo_numero, pd.data_disponibilizacao, pd.data_publicacao, pd.created_at, pd.conteudo),
        NULLIF(btrim(pd.id_djen), ''),
        concat_ws('|', 'legacy', pd.dedup_processo_digits, pd.dedup_data_ref::text, pd.dedup_head_norm),
        'row|termo|' || pd.id::text
      ) AS dedup_uid,
      CASE WHEN md.tipo = 'parte' THEN 0 ELSE 1 END AS prio,
      CASE WHEN pd.status = 'encontrada' THEN 0 ELSE 1 END AS status_prio
    FROM public.publicacoes_djen pd
    JOIN public.monitoramentos_djen md ON md.id = pd.monitoramento_id
    LEFT JOIN public.coordenacoes c ON c.id = COALESCE(pd.coordenacao_id, md.coordenacao_id)
    WHERE (p_coordenacao_id IS NULL OR COALESCE(pd.coordenacao_id, md.coordenacao_id) = p_coordenacao_id)
      AND (v_is_admin OR EXISTS (SELECT 1 FROM public.membros_coordenacao mc WHERE mc.coordenacao_id = COALESCE(pd.coordenacao_id, md.coordenacao_id) AND mc.usuario_id = v_uid))
      AND pd.status IN ('encontrada','duplicada')
      AND (v_tipo IS NULL OR v_tipo IN ('termo','parte'))
      AND (v_tipo IS DISTINCT FROM 'parte' OR md.tipo = 'parte')
      AND COALESCE(pd.fonte, '') <> 'dejt-pdf'
      AND (p_monitoramento_id IS NULL OR pd.monitoramento_id = p_monitoramento_id)
      AND (p_inicio IS NULL OR pd.created_at >= p_inicio)
      AND (p_fim IS NULL OR pd.created_at <= p_fim)
      AND (p_data_disponibilizacao_inicio IS NULL OR pd.data_disponibilizacao >= p_data_disponibilizacao_inicio)
      AND (p_data_disponibilizacao_fim IS NULL OR pd.data_disponibilizacao <= p_data_disponibilizacao_fim)
      AND (v_tribunal IS NULL OR upper(COALESCE(pd.tribunal, pd.fonte, '')) ~ ('(^|[^A-Z0-9])' || v_tribunal || '([^A-Z0-9]|$)'))
      AND (NOT p_apenas_nao_lidas OR pd.lida = false)
      AND (v_q IS NULL OR pd.conteudo ILIKE ('%'||v_q||'%') OR pd.processo_numero ILIKE ('%'||v_q||'%') OR md.termo_busca ILIKE ('%'||v_q||'%')
           OR (v_q_digits IS NOT NULL AND regexp_replace(COALESCE(pd.processo_numero,''),'[^0-9]','','g') LIKE ('%'||v_q_digits||'%')))
    UNION ALL
    SELECT pdp.id, 'processo'::text, pdp.processo_id, pdp.processo_numero, pdp.conteudo,
      pdp.data_publicacao, pdp.data_disponibilizacao, pdp.fonte, pdp.lida, pdp.created_at,
      NULL::uuid, NULL::text, NULL::text, NULL::text, NULL::text, NULL::text,
      pdp.coordenacao_id, c2.nome,
      p.polo_ativo, p.polo_passivo, pdp.tribunal, pdp.orgao, pdp.tipo_comunicacao, pdp.meio,
      pdp.advogados_json, pdp.partes_json,
      pdp.coordenacao_id,
      COALESCE(
        public.compute_djen_conteudo_dedup_key(pdp.coordenacao_id, pdp.processo_numero, pdp.data_disponibilizacao, pdp.data_publicacao, pdp.created_at, pdp.conteudo),
        NULLIF(btrim(pdp.id_djen), ''),
        concat_ws('|', 'legacy', pdp.dedup_processo_digits, pdp.dedup_data_ref::text, pdp.dedup_head_norm),
        'row|processo|' || pdp.id::text
      ),
      2, CASE WHEN pdp.status = 'encontrada' THEN 0 ELSE 1 END
    FROM public.publicacoes_djen_processos pdp
    JOIN public.processos p ON p.id = pdp.processo_id
    JOIN public.coordenacoes c2 ON c2.id = pdp.coordenacao_id
    WHERE (p_coordenacao_id IS NULL OR pdp.coordenacao_id = p_coordenacao_id)
      AND (v_is_admin OR EXISTS (SELECT 1 FROM public.membros_coordenacao mc WHERE mc.coordenacao_id = pdp.coordenacao_id AND mc.usuario_id = v_uid))
      AND pdp.status IN ('encontrada','duplicada')
      AND (v_tipo IS NULL OR v_tipo = 'processo')
      AND p_monitoramento_id IS NULL
      AND (p_inicio IS NULL OR pdp.created_at >= p_inicio)
      AND (p_fim IS NULL OR pdp.created_at <= p_fim)
      AND (p_data_disponibilizacao_inicio IS NULL OR pdp.data_disponibilizacao >= p_data_disponibilizacao_inicio)
      AND (p_data_disponibilizacao_fim IS NULL OR pdp.data_disponibilizacao <= p_data_disponibilizacao_fim)
      AND (v_tribunal IS NULL OR upper(COALESCE(pdp.tribunal, pdp.fonte, '')) ~ ('(^|[^A-Z0-9])' || v_tribunal || '([^A-Z0-9]|$)'))
      AND (NOT p_apenas_nao_lidas OR pdp.lida = false)
      AND (v_q IS NULL OR pdp.conteudo ILIKE ('%'||v_q||'%') OR pdp.processo_numero ILIKE ('%'||v_q||'%')
           OR COALESCE(p.polo_ativo,'') ILIKE ('%'||v_q||'%') OR COALESCE(p.polo_passivo,'') ILIKE ('%'||v_q||'%')
           OR (v_q_digits IS NOT NULL AND regexp_replace(COALESCE(pdp.processo_numero,''),'[^0-9]','','g') LIKE ('%'||v_q_digits||'%')))
  ),
  ranked AS (
    SELECT DISTINCT ON (b.dedup_coord, b.dedup_uid) b.*
    FROM base b
    ORDER BY b.dedup_coord, b.dedup_uid, b.status_prio, b.prio, length(COALESCE(b.conteudo, '')) DESC, b.created_at DESC, b.id DESC
  ),
  filtered AS (
    SELECT r.*, EXISTS (SELECT 1 FROM public.publicacoes_djen_leituras l WHERE l.publicacao_id=r.id AND l.tabela_origem=r.tipo_origem AND l.usuario_id=v_uid) AS lida_por_user
    FROM ranked r
  ),
  final_rows AS (
    SELECT f.* FROM filtered f
    WHERE v_read='todas' OR (v_read='nao_lidas' AND NOT f.lida_por_user) OR (v_read='lidas' AND f.lida_por_user)
    ORDER BY f.created_at DESC LIMIT GREATEST(p_limit,1) OFFSET GREATEST(p_offset,0)
  )
  SELECT f.id, f.tipo_origem, f.processo_id, f.processo_numero, f.conteudo,
    f.data_publicacao, f.data_disponibilizacao, f.fonte, f.lida_por_user, f.created_at,
    f.monitoramento_id, f.monitoramento_termo, f.monitoramento_descricao, f.monitoramento_tipo,
    f.monitoramento_oab, f.monitoramento_uf, f.coordenacao_id, f.coordenacao_nome,
    f.polo_ativo, f.polo_passivo, f.tribunal, f.orgao, f.tipo_comunicacao, f.meio,
    f.advogados_json, f.partes_json,
    COALESCE((SELECT jsonb_agg(jsonb_build_object('nome',COALESCE(l.usuario_nome,'Desconhecido'),'lida_em',l.lida_em) ORDER BY l.lida_em DESC)
              FROM public.publicacoes_djen_leituras l WHERE l.publicacao_id=f.id AND l.tabela_origem=f.tipo_origem),'[]'::jsonb)
  FROM final_rows f ORDER BY f.created_at DESC;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_djen_publicacoes_unificadas(uuid, timestamptz, timestamptz, boolean, text, integer, integer, uuid, text, text, timestamptz, timestamptz, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_djen_publicacoes_unificadas(uuid, timestamptz, timestamptz, boolean, text, integer, integer, uuid, text, text, timestamptz, timestamptz, text) TO service_role;

DROP FUNCTION IF EXISTS public.get_djen_stats_per_user(uuid, timestamptz, timestamptz, text, text, uuid, timestamptz, timestamptz, text);

CREATE OR REPLACE FUNCTION public.get_djen_stats_per_user(
  p_coordenacao_id uuid DEFAULT NULL,
  p_inicio timestamp with time zone DEFAULT NULL,
  p_fim timestamp with time zone DEFAULT NULL,
  p_tipo_origem text DEFAULT NULL,
  p_search_query text DEFAULT NULL,
  p_monitoramento_id uuid DEFAULT NULL,
  p_data_disponibilizacao_inicio timestamp with time zone DEFAULT NULL,
  p_data_disponibilizacao_fim timestamp with time zone DEFAULT NULL,
  p_tribunal text DEFAULT NULL
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
  v_uid uuid; v_q text; v_q_digits text; v_tipo text; v_is_admin boolean; v_tribunal text;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not authenticated' USING ERRCODE = '28000'; END IF;
  v_is_admin := public.is_admin_or_coordenador(v_uid);
  IF p_coordenacao_id IS NOT NULL AND NOT v_is_admin
     AND NOT EXISTS (SELECT 1 FROM public.membros_coordenacao mc WHERE mc.coordenacao_id = p_coordenacao_id AND mc.usuario_id = v_uid)
  THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  v_tipo := NULLIF(btrim(COALESCE(p_tipo_origem, '')), '');
  IF v_tipo = 'todos' THEN v_tipo := NULL; END IF;
  v_q := NULLIF(btrim(COALESCE(p_search_query, '')), '');
  v_q_digits := CASE WHEN v_q IS NOT NULL THEN regexp_replace(v_q, '[^0-9]', '', 'g') ELSE NULL END;
  IF v_q_digits IS NOT NULL AND length(v_q_digits) < 5 THEN v_q_digits := NULL; END IF;
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
      AND (v_tipo IS NULL OR v_tipo IN ('termo', 'parte', 'djet-pautas'))
      AND (v_tipo IS DISTINCT FROM 'parte' OR md.tipo = 'parte')
      AND (v_tipo = 'djet-pautas' OR COALESCE(pd.fonte, '') <> 'dejt-pdf')
      AND (v_tipo IS DISTINCT FROM 'djet-pautas' OR pd.fonte = 'dejt-pdf')
      AND (p_monitoramento_id IS NULL OR pd.monitoramento_id = p_monitoramento_id)
      AND (p_inicio IS NULL OR pd.created_at >= p_inicio)
      AND (p_fim IS NULL OR pd.created_at <= p_fim)
      AND (p_data_disponibilizacao_inicio IS NULL OR pd.data_disponibilizacao >= p_data_disponibilizacao_inicio)
      AND (p_data_disponibilizacao_fim IS NULL OR pd.data_disponibilizacao <= p_data_disponibilizacao_fim)
      AND (v_tribunal IS NULL OR upper(COALESCE(pd.tribunal, pd.fonte, '')) ~ ('(^|[^A-Z0-9])' || v_tribunal || '([^A-Z0-9]|$)'))
      AND (v_q IS NULL OR pd.processo_numero ILIKE ('%' || v_q || '%') OR md.termo_busca ILIKE ('%' || v_q || '%')
        OR (v_q_digits IS NOT NULL AND regexp_replace(COALESCE(pd.processo_numero, ''), '[^0-9]', '', 'g') LIKE ('%' || v_q_digits || '%'))
        OR pd.conteudo ILIKE ('%' || v_q || '%'))
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
      AND (v_tipo IS NULL OR v_tipo = 'processo')
      AND p_monitoramento_id IS NULL
      AND (p_inicio IS NULL OR pdp.created_at >= p_inicio)
      AND (p_fim IS NULL OR pdp.created_at <= p_fim)
      AND (p_data_disponibilizacao_inicio IS NULL OR pdp.data_disponibilizacao >= p_data_disponibilizacao_inicio)
      AND (p_data_disponibilizacao_fim IS NULL OR pdp.data_disponibilizacao <= p_data_disponibilizacao_fim)
      AND (v_tribunal IS NULL OR upper(COALESCE(pdp.tribunal, pdp.fonte, '')) ~ ('(^|[^A-Z0-9])' || v_tribunal || '([^A-Z0-9]|$)'))
      AND (v_q IS NULL OR pdp.processo_numero ILIKE ('%' || v_q || '%')
        OR (v_q_digits IS NOT NULL AND regexp_replace(COALESCE(pdp.processo_numero, ''), '[^0-9]', '', 'g') LIKE ('%' || v_q_digits || '%'))
        OR pdp.conteudo ILIKE ('%' || v_q || '%')
        OR COALESCE(pr.polo_ativo, '') ILIKE ('%' || v_q || '%')
        OR COALESCE(pr.polo_passivo, '') ILIKE ('%' || v_q || '%'))
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

GRANT EXECUTE ON FUNCTION public.get_djen_stats_per_user(uuid, timestamptz, timestamptz, text, text, uuid, timestamptz, timestamptz, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_djen_stats_per_user(uuid, timestamptz, timestamptz, text, text, uuid, timestamptz, timestamptz, text) TO service_role;