CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_pd_dedup_proc_digits_trgm ON public.publicacoes_djen USING gin (dedup_processo_digits gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_pdp_dedup_proc_digits_trgm ON public.publicacoes_djen_processos USING gin (dedup_processo_digits gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_pdd_dedup_proc_digits_trgm ON public.publicacoes_djen_descartadas USING gin (dedup_processo_digits gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_pd_proc_numero_trgm ON public.publicacoes_djen USING gin (processo_numero gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_pdp_proc_numero_trgm ON public.publicacoes_djen_processos USING gin (processo_numero gin_trgm_ops);

CREATE OR REPLACE FUNCTION public.get_djen_publicacoes_unificadas(p_coordenacao_id uuid DEFAULT NULL::uuid, p_inicio timestamp with time zone DEFAULT NULL::timestamp with time zone, p_fim timestamp with time zone DEFAULT NULL::timestamp with time zone, p_apenas_nao_lidas boolean DEFAULT false, p_search_query text DEFAULT NULL::text, p_limit integer DEFAULT 500, p_offset integer DEFAULT 0, p_monitoramento_id uuid DEFAULT NULL::uuid, p_tipo_origem text DEFAULT NULL::text, p_read_status text DEFAULT 'todas'::text, p_data_disponibilizacao_inicio timestamp with time zone DEFAULT NULL::timestamp with time zone, p_data_disponibilizacao_fim timestamp with time zone DEFAULT NULL::timestamp with time zone, p_tribunal text DEFAULT NULL::text, p_dedup boolean DEFAULT false, p_conteudo_query text DEFAULT NULL::text)
 RETURNS TABLE(id uuid, tipo_origem text, processo_id uuid, processo_numero text, conteudo text, data_publicacao timestamp with time zone, data_disponibilizacao timestamp with time zone, fonte text, lida boolean, created_at timestamp with time zone, monitoramento_id uuid, monitoramento_termo text, monitoramento_descricao text, monitoramento_tipo text, monitoramento_oab text, monitoramento_uf text, coordenacao_id uuid, coordenacao_nome text, polo_ativo text, polo_passivo text, tribunal text, orgao text, tipo_comunicacao text, meio text, advogados_json jsonb, partes_json jsonb, lido_por jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
 SET statement_timeout TO '30s'
AS $function$
DECLARE
  v_uid uuid; v_q text; v_q_digits text; v_tipo text; v_read text;
  v_is_admin boolean; v_tribunal text; v_qc text; v_proc text;
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
  -- FAST PATH: busca por número de processo (>= 11 dígitos) usa apenas os
  -- dígitos normalizados (indexados), sem varrer conteudo/partes/advogados.
  v_proc := CASE WHEN v_q_digits IS NOT NULL AND length(v_q_digits) >= 11 THEN v_q_digits ELSE NULL END;
  v_tribunal := NULLIF(regexp_replace(upper(COALESCE(p_tribunal, '')), '[^A-Z0-9]', '', 'g'), '');
  v_qc := NULLIF(btrim(COALESCE(p_conteudo_query, '')), '');

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
      AND (v_tipo IS NULL OR COALESCE(pd.fonte, '') <> 'dejt-pdf')
      AND (p_monitoramento_id IS NULL OR pd.monitoramento_id = p_monitoramento_id)
      AND (p_inicio IS NULL OR pd.created_at >= p_inicio)
      AND (p_fim IS NULL OR pd.created_at <= p_fim)
      AND (p_data_disponibilizacao_inicio IS NULL OR CASE
            WHEN lower(COALESCE(pd.fonte,'')) = 'kurier'
              THEN (pd.created_at AT TIME ZONE 'America/Sao_Paulo')::date >= (p_data_disponibilizacao_inicio AT TIME ZONE 'America/Sao_Paulo')::date
            WHEN lower(COALESCE(pd.fonte,'')) = 'dejt-pdf'
              THEN pd.data_publicacao >= p_data_disponibilizacao_inicio
            ELSE pd.data_disponibilizacao >= p_data_disponibilizacao_inicio END)
      AND (p_data_disponibilizacao_fim IS NULL OR CASE
            WHEN lower(COALESCE(pd.fonte,'')) = 'kurier'
              THEN (pd.created_at AT TIME ZONE 'America/Sao_Paulo')::date <= (p_data_disponibilizacao_fim AT TIME ZONE 'America/Sao_Paulo')::date
            WHEN lower(COALESCE(pd.fonte,'')) = 'dejt-pdf'
              THEN pd.data_publicacao <= p_data_disponibilizacao_fim
            ELSE pd.data_disponibilizacao <= p_data_disponibilizacao_fim END)
      AND (v_tribunal IS NULL OR upper(COALESCE(pd.tribunal, pd.fonte, '')) ~ ('(^|[^A-Z0-9])' || v_tribunal || '([^A-Z0-9]|$)'))
      AND (
        v_q IS NULL
        OR (v_proc IS NOT NULL AND (
              COALESCE(pd.dedup_processo_digits, '') LIKE ('%'||v_proc||'%')
              OR regexp_replace(COALESCE(pd.processo_numero,''),'[^0-9]','','g') LIKE ('%'||v_proc||'%')
           ))
        OR (v_proc IS NULL AND (
              pd.conteudo ILIKE ('%'||v_q||'%') OR pd.processo_numero ILIKE ('%'||v_q||'%') OR md.termo_busca ILIKE ('%'||v_q||'%')
              OR COALESCE(pd.polo_ativo,'') ILIKE ('%'||v_q||'%') OR COALESCE(pd.polo_passivo,'') ILIKE ('%'||v_q||'%')
              OR pd.advogados_json::text ILIKE ('%'||v_q||'%')
              OR pd.partes_json::text ILIKE ('%'||v_q||'%')
              OR (v_q_digits IS NOT NULL AND regexp_replace(COALESCE(pd.processo_numero,''),'[^0-9]','','g') LIKE ('%'||v_q_digits||'%'))
           ))
      )
      AND (v_qc IS NULL OR pd.conteudo ILIKE ('%'||v_qc||'%'))
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
        OR (v_proc IS NOT NULL AND (
              COALESCE(pdp.dedup_processo_digits, '') LIKE ('%'||v_proc||'%')
              OR regexp_replace(COALESCE(pdp.processo_numero,''),'[^0-9]','','g') LIKE ('%'||v_proc||'%')
           ))
        OR (v_proc IS NULL AND (
              pdp.conteudo ILIKE ('%'||v_q||'%') OR pdp.processo_numero ILIKE ('%'||v_q||'%')
              OR COALESCE(p.polo_ativo,'') ILIKE ('%'||v_q||'%') OR COALESCE(p.polo_passivo,'') ILIKE ('%'||v_q||'%')
              OR pdp.advogados_json::text ILIKE ('%'||v_q||'%')
              OR pdp.partes_json::text ILIKE ('%'||v_q||'%')
              OR (v_q_digits IS NOT NULL AND regexp_replace(COALESCE(pdp.processo_numero,''),'[^0-9]','','g') LIKE ('%'||v_q_digits||'%'))
           ))
      )
      AND (v_qc IS NULL OR pdp.conteudo ILIKE ('%'||v_qc||'%'))
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

CREATE OR REPLACE FUNCTION public.get_djen_stats_per_user(p_coordenacao_id uuid DEFAULT NULL::uuid, p_inicio timestamp with time zone DEFAULT NULL::timestamp with time zone, p_fim timestamp with time zone DEFAULT NULL::timestamp with time zone, p_tipo_origem text DEFAULT NULL::text, p_search_query text DEFAULT NULL::text, p_monitoramento_id uuid DEFAULT NULL::uuid, p_data_disponibilizacao_inicio timestamp with time zone DEFAULT NULL::timestamp with time zone, p_data_disponibilizacao_fim timestamp with time zone DEFAULT NULL::timestamp with time zone, p_tribunal text DEFAULT NULL::text)
 RETURNS TABLE(total_termos bigint, total_processos bigint, nao_lidas_termos bigint, nao_lidas_processos bigint, total_unicas bigint, nao_lidas_unicas bigint, total_bruto bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
 SET statement_timeout TO '40s'
AS $function$
DECLARE
  v_uid uuid;
  v_q text;
  v_q_digits text;
  v_tipo text;
  v_is_admin boolean;
  v_tribunal text;
  v_proc text;
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
  v_proc := CASE WHEN v_q_digits IS NOT NULL AND length(v_q_digits) >= 11 THEN v_q_digits ELSE NULL END;
  v_tribunal := NULLIF(regexp_replace(upper(COALESCE(p_tribunal, '')), '[^A-Z0-9]', '', 'g'), '');

  RETURN QUERY
  WITH base_raw AS (
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
      EXISTS (SELECT 1 FROM public.publicacoes_djen_leituras l WHERE l.publicacao_id = pd.id AND l.tabela_origem = 'termo' AND l.usuario_id = v_uid) AS lida_por_user_row
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
        OR (v_proc IS NOT NULL AND (
              COALESCE(pd.dedup_processo_digits, '') LIKE ('%'||v_proc||'%')
              OR regexp_replace(COALESCE(pd.processo_numero, ''), '[^0-9]', '', 'g') LIKE ('%'||v_proc||'%')
           ))
        OR (v_proc IS NULL AND (
              pd.processo_numero ILIKE ('%' || v_q || '%') OR md.termo_busca ILIKE ('%' || v_q || '%')
              OR (v_q_digits IS NOT NULL AND regexp_replace(COALESCE(pd.processo_numero, ''), '[^0-9]', '', 'g') LIKE ('%' || v_q_digits || '%'))
              OR pd.conteudo ILIKE ('%' || v_q || '%')
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
      EXISTS (SELECT 1 FROM public.publicacoes_djen_leituras l WHERE l.publicacao_id = pdp.id AND l.tabela_origem = 'processo' AND l.usuario_id = v_uid) AS lida_por_user_row
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
        OR (v_proc IS NOT NULL AND (
              COALESCE(pdp.dedup_processo_digits, '') LIKE ('%'||v_proc||'%')
              OR regexp_replace(COALESCE(pdp.processo_numero, ''), '[^0-9]', '', 'g') LIKE ('%'||v_proc||'%')
           ))
        OR (v_proc IS NULL AND (
              pdp.processo_numero ILIKE ('%' || v_q || '%')
              OR (v_q_digits IS NOT NULL AND regexp_replace(COALESCE(pdp.processo_numero, ''), '[^0-9]', '', 'g') LIKE ('%' || v_q_digits || '%'))
              OR pdp.conteudo ILIKE ('%' || v_q || '%')
              OR COALESCE(pr.polo_ativo, '') ILIKE ('%' || v_q || '%')
              OR COALESCE(pr.polo_passivo, '') ILIKE ('%' || v_q || '%')
           ))
      )
  ),
  base AS (
    SELECT b.*,
      bool_or(b.lida_por_user_row) OVER (PARTITION BY b.dedup_coord, b.dedup_uid) AS lida_por_user
    FROM base_raw b
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

CREATE OR REPLACE FUNCTION public.count_djen_publicacoes_unificadas(p_coordenacao_id uuid, p_inicio timestamp with time zone DEFAULT NULL::timestamp with time zone, p_fim timestamp with time zone DEFAULT NULL::timestamp with time zone, p_apenas_nao_lidas boolean DEFAULT false, p_search_query text DEFAULT NULL::text, p_monitoramento_id uuid DEFAULT NULL::uuid)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid;
  v_q text;
  v_q_digits text;
  v_proc text;
  v_count bigint;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '28000';
  END IF;
  IF p_coordenacao_id IS NULL THEN
    RAISE EXCEPTION 'coordenacao_id is required' USING ERRCODE = '22004';
  END IF;
  IF NOT public.is_admin_or_coordenador(v_uid)
     AND NOT EXISTS (
       SELECT 1 FROM public.membros_coordenacao mc
       WHERE mc.coordenacao_id = p_coordenacao_id AND mc.usuario_id = v_uid
     )
  THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  v_q := NULLIF(btrim(p_search_query), '');
  v_q_digits := CASE WHEN v_q IS NOT NULL THEN regexp_replace(v_q, '[^0-9]', '', 'g') ELSE NULL END;
  IF v_q_digits IS NOT NULL AND length(v_q_digits) < 5 THEN
    v_q_digits := NULL;
  END IF;
  v_proc := CASE WHEN v_q_digits IS NOT NULL AND length(v_q_digits) >= 11 THEN v_q_digits ELSE NULL END;

  WITH
    base AS (
      SELECT
        (
          md.coordenacao_id::text
          || '|' || regexp_replace(COALESCE(pd.processo_numero, ''), '[^0-9]', '', 'g')
          || '|' || COALESCE(
            to_char(pd.data_publicacao::date, 'YYYY-MM-DD'),
            to_char(pd.data_disponibilizacao::date, 'YYYY-MM-DD'),
            to_char(pd.created_at::date, 'YYYY-MM-DD')
          )
          || '|' || left(lower(regexp_replace(regexp_replace(regexp_replace(
            COALESCE(public.strip_destinatarios(pd.conteudo), ''),
            '<[^>]*>', ' ', 'g'), '[^\w\s]', ' ', 'g'), '\s+', ' ', 'g')), 300)
        ) AS dedup_key
      FROM public.publicacoes_djen pd
      JOIN public.monitoramentos_djen md ON md.id = pd.monitoramento_id
      WHERE md.coordenacao_id = p_coordenacao_id
        AND (p_inicio IS NULL OR pd.created_at >= p_inicio)
        AND (p_fim IS NULL OR pd.created_at <= p_fim)
        AND (NOT p_apenas_nao_lidas OR pd.lida = false)
        AND (p_monitoramento_id IS NULL OR pd.monitoramento_id = p_monitoramento_id)
        AND (
          v_q IS NULL
          OR (v_proc IS NOT NULL AND (
                COALESCE(pd.dedup_processo_digits, '') LIKE ('%'||v_proc||'%')
                OR regexp_replace(COALESCE(pd.processo_numero, ''), '[^0-9]', '', 'g') LIKE ('%'||v_proc||'%')
             ))
          OR (v_proc IS NULL AND (
                pd.conteudo ILIKE ('%' || v_q || '%')
                OR pd.processo_numero ILIKE ('%' || v_q || '%')
                OR md.termo_busca ILIKE ('%' || v_q || '%')
                OR (v_q_digits IS NOT NULL AND regexp_replace(COALESCE(pd.processo_numero, ''), '[^0-9]', '', 'g') LIKE ('%' || v_q_digits || '%'))
             ))
        )

      UNION ALL

      SELECT
        (
          p.coordenacao_id::text
          || '|' || regexp_replace(COALESCE(pdp.processo_numero, ''), '[^0-9]', '', 'g')
          || '|' || COALESCE(
            to_char(pdp.data_publicacao::date, 'YYYY-MM-DD'),
            to_char(pdp.data_disponibilizacao::date, 'YYYY-MM-DD'),
            to_char(pdp.created_at::date, 'YYYY-MM-DD')
          )
          || '|' || left(lower(regexp_replace(regexp_replace(regexp_replace(
            COALESCE(public.strip_destinatarios(pdp.conteudo), ''),
            '<[^>]*>', ' ', 'g'), '[^\w\s]', ' ', 'g'), '\s+', ' ', 'g')), 300)
        ) AS dedup_key
      FROM public.publicacoes_djen_processos pdp
      JOIN public.processos p ON p.id = pdp.processo_id
      WHERE p.coordenacao_id = p_coordenacao_id
        AND (p_inicio IS NULL OR pdp.created_at >= p_inicio)
        AND (p_fim IS NULL OR pdp.created_at <= p_fim)
        AND (NOT p_apenas_nao_lidas OR pdp.lida = false)
        AND (
          v_q IS NULL
          OR (v_proc IS NOT NULL AND (
                COALESCE(pdp.dedup_processo_digits, '') LIKE ('%'||v_proc||'%')
                OR regexp_replace(COALESCE(pdp.processo_numero, ''), '[^0-9]', '', 'g') LIKE ('%'||v_proc||'%')
             ))
          OR (v_proc IS NULL AND (
                pdp.conteudo ILIKE ('%' || v_q || '%')
                OR pdp.processo_numero ILIKE ('%' || v_q || '%')
                OR COALESCE(p.polo_ativo, '') ILIKE ('%' || v_q || '%')
                OR COALESCE(p.polo_passivo, '') ILIKE ('%' || v_q || '%')
                OR (v_q_digits IS NOT NULL AND regexp_replace(COALESCE(pdp.processo_numero, ''), '[^0-9]', '', 'g') LIKE ('%' || v_q_digits || '%'))
             ))
        )
    )
  SELECT count(DISTINCT dedup_key) INTO v_count FROM base;

  RETURN v_count;
END;
$function$;