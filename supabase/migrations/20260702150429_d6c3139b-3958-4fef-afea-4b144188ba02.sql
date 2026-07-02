-- =====================================================================
-- FIX: Publicações lidas voltando como "Nova" após recaptura
-- =====================================================================
-- Causa: dedup preferia o registro NÃO lido do grupo; leituras órfãs
-- ficavam no registro antigo. Agora: qualquer leitura em qualquer variante
-- do mesmo grupo (coord + dedup_uid) conta como lida, e o dedup prefere o
-- registro já lido pelo usuário atual.
-- =====================================================================

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
  v_uid uuid; v_q text; v_q_digits text; v_tipo text; v_read text;
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
      AND (v_q IS NULL OR ps.conteudo ILIKE ('%' || v_q || '%') OR ps.processo_numero ILIKE ('%' || v_q || '%')
        OR md.termo_busca ILIKE ('%' || v_q || '%')
        OR (v_q_digits IS NOT NULL AND regexp_replace(COALESCE(ps.processo_numero, ''), '[^0-9]', '', 'g') LIKE ('%' || v_q_digits || '%')))
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
  v_uid uuid; v_q text; v_q_digits text; v_tipo text; v_read text;
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
      AND (v_q IS NULL OR pdp.conteudo ILIKE ('%'||v_q||'%') OR pdp.processo_numero ILIKE ('%'||v_q||'%')
           OR COALESCE(p.polo_ativo,'') ILIKE ('%'||v_q||'%') OR COALESCE(p.polo_passivo,'') ILIKE ('%'||v_q||'%')
           OR (v_q_digits IS NOT NULL AND regexp_replace(COALESCE(pdp.processo_numero,''),'[^0-9]','','g') LIKE ('%'||v_q_digits||'%')))
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