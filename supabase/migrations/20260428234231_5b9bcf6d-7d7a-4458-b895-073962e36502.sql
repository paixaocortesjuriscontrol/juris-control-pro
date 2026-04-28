DROP FUNCTION IF EXISTS public.get_djen_publicacoes_unificadas(uuid, timestamptz, timestamptz, boolean, text, integer, integer, uuid);

CREATE OR REPLACE FUNCTION public.get_djen_publicacoes_unificadas(
  p_coordenacao_id uuid,
  p_inicio timestamptz DEFAULT NULL,
  p_fim timestamptz DEFAULT NULL,
  p_apenas_nao_lidas boolean DEFAULT false,
  p_search_query text DEFAULT NULL,
  p_limit integer DEFAULT 500,
  p_offset integer DEFAULT 0,
  p_monitoramento_id uuid DEFAULT NULL,
  p_tipo_origem text DEFAULT NULL,
  p_read_status text DEFAULT 'todas'
)
RETURNS TABLE(id uuid, tipo_origem text, processo_id uuid, processo_numero text, conteudo text, data_publicacao timestamptz, data_disponibilizacao timestamptz, fonte text, lida boolean, created_at timestamptz, monitoramento_id uuid, monitoramento_termo text, monitoramento_descricao text, monitoramento_tipo text, monitoramento_oab text, monitoramento_uf text, coordenacao_id uuid, coordenacao_nome text, polo_ativo text, polo_passivo text, tribunal text, orgao text, tipo_comunicacao text, meio text, advogados_json jsonb, partes_json jsonb)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid;
  v_q text;
  v_q_digits text;
  v_tipo text;
  v_read text;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not authenticated' USING ERRCODE = '28000'; END IF;
  IF p_coordenacao_id IS NULL THEN RAISE EXCEPTION 'coordenacao_id is required' USING ERRCODE = '22004'; END IF;
  IF NOT public.is_admin_or_coordenador(v_uid)
     AND NOT EXISTS (SELECT 1 FROM public.membros_coordenacao mc WHERE mc.coordenacao_id = p_coordenacao_id AND mc.usuario_id = v_uid)
  THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;

  v_tipo := NULLIF(btrim(COALESCE(p_tipo_origem, '')), '');
  IF v_tipo = 'todos' THEN v_tipo := NULL; END IF;
  v_read := COALESCE(NULLIF(btrim(p_read_status), ''), 'todas');
  v_q := NULLIF(btrim(p_search_query), '');
  v_q_digits := CASE WHEN v_q IS NOT NULL THEN regexp_replace(v_q, '[^0-9]', '', 'g') ELSE NULL END;
  IF v_q_digits IS NOT NULL AND length(v_q_digits) < 5 THEN v_q_digits := NULL; END IF;

  RETURN QUERY
  WITH base AS (
    SELECT pd.id, 'termo'::text AS tipo_origem, NULL::uuid AS processo_id, pd.processo_numero, pd.conteudo,
      pd.data_publicacao, pd.data_disponibilizacao, pd.fonte, pd.lida, pd.created_at, pd.monitoramento_id,
      md.termo_busca AS monitoramento_termo, md.descricao AS monitoramento_descricao, md.tipo AS monitoramento_tipo,
      md.oab AS monitoramento_oab, md.uf AS monitoramento_uf, pd.coordenacao_id, c.nome AS coordenacao_nome,
      pd.polo_ativo, pd.polo_passivo, pd.tribunal, pd.orgao, pd.tipo_comunicacao, pd.meio,
      pd.advogados_json, pd.partes_json,
      (pd.coordenacao_id::text || '|' || regexp_replace(COALESCE(pd.processo_numero, ''), '[^0-9]', '', 'g')
        || '|' || COALESCE(to_char(pd.data_disponibilizacao::date, 'YYYY-MM-DD'), to_char(pd.data_publicacao::date, 'YYYY-MM-DD'), to_char(pd.created_at::date, 'YYYY-MM-DD'))
        || '|' || left(lower(regexp_replace(regexp_replace(regexp_replace(COALESCE(public.strip_destinatarios(pd.conteudo), ''), '<[^>]*>', ' ', 'g'), '[^\w\s]', ' ', 'g'), '\s+', ' ', 'g')), 300)
      ) AS dedup_key,
      CASE WHEN md.tipo = 'parte' THEN 0 ELSE 1 END AS prio
    FROM public.publicacoes_djen pd
    JOIN public.monitoramentos_djen md ON md.id = pd.monitoramento_id
    JOIN public.coordenacoes c ON c.id = pd.coordenacao_id
    WHERE pd.coordenacao_id = p_coordenacao_id
      AND (v_tipo IS NULL OR v_tipo IN ('termo', 'parte'))
      AND (v_tipo IS DISTINCT FROM 'parte' OR md.tipo = 'parte')
      AND (p_monitoramento_id IS NULL OR pd.monitoramento_id = p_monitoramento_id)
      AND (p_inicio IS NULL OR pd.created_at >= p_inicio)
      AND (p_fim IS NULL OR pd.created_at <= p_fim)
      AND (NOT p_apenas_nao_lidas OR pd.lida = false)
      AND (v_q IS NULL OR pd.conteudo ILIKE ('%' || v_q || '%') OR pd.processo_numero ILIKE ('%' || v_q || '%') OR md.termo_busca ILIKE ('%' || v_q || '%') OR (v_q_digits IS NOT NULL AND regexp_replace(COALESCE(pd.processo_numero, ''), '[^0-9]', '', 'g') LIKE ('%' || v_q_digits || '%')))

    UNION ALL

    SELECT pdp.id, 'processo'::text AS tipo_origem, pdp.processo_id, pdp.processo_numero, pdp.conteudo,
      pdp.data_publicacao, pdp.data_disponibilizacao, pdp.fonte, pdp.lida, pdp.created_at,
      NULL::uuid AS monitoramento_id, NULL::text, NULL::text, NULL::text, NULL::text, NULL::text,
      pdp.coordenacao_id, c2.nome AS coordenacao_nome, p.polo_ativo, p.polo_passivo,
      pdp.tribunal, pdp.orgao, pdp.tipo_comunicacao, pdp.meio, pdp.advogados_json, pdp.partes_json,
      (pdp.coordenacao_id::text || '|' || regexp_replace(COALESCE(pdp.processo_numero, ''), '[^0-9]', '', 'g')
        || '|' || COALESCE(to_char(pdp.data_disponibilizacao::date, 'YYYY-MM-DD'), to_char(pdp.data_publicacao::date, 'YYYY-MM-DD'), to_char(pdp.created_at::date, 'YYYY-MM-DD'))
        || '|' || left(lower(regexp_replace(regexp_replace(regexp_replace(COALESCE(public.strip_destinatarios(pdp.conteudo), ''), '<[^>]*>', ' ', 'g'), '[^\w\s]', ' ', 'g'), '\s+', ' ', 'g')), 300)
      ) AS dedup_key,
      2 AS prio
    FROM public.publicacoes_djen_processos pdp
    JOIN public.processos p ON p.id = pdp.processo_id
    JOIN public.coordenacoes c2 ON c2.id = pdp.coordenacao_id
    WHERE pdp.coordenacao_id = p_coordenacao_id
      AND (v_tipo IS NULL OR v_tipo = 'processo')
      AND p_monitoramento_id IS NULL
      AND (p_inicio IS NULL OR pdp.created_at >= p_inicio)
      AND (p_fim IS NULL OR pdp.created_at <= p_fim)
      AND (NOT p_apenas_nao_lidas OR pdp.lida = false)
      AND (v_q IS NULL OR pdp.conteudo ILIKE ('%' || v_q || '%') OR pdp.processo_numero ILIKE ('%' || v_q || '%') OR COALESCE(p.polo_ativo, '') ILIKE ('%' || v_q || '%') OR COALESCE(p.polo_passivo, '') ILIKE ('%' || v_q || '%') OR (v_q_digits IS NOT NULL AND regexp_replace(COALESCE(pdp.processo_numero, ''), '[^0-9]', '', 'g') LIKE ('%' || v_q_digits || '%')))
  ),
  ranked AS (
    SELECT DISTINCT ON (b.dedup_key) b.*
    FROM base b
    ORDER BY b.dedup_key, b.prio, b.created_at DESC
  ),
  filtered AS (
    SELECT r.*
    FROM ranked r
    WHERE v_read = 'todas'
      OR (v_read = 'nao_lidas' AND NOT EXISTS (SELECT 1 FROM public.publicacoes_djen_leituras l WHERE l.publicacao_id = r.id AND l.tabela_origem = r.tipo_origem AND l.usuario_id = v_uid))
      OR (v_read = 'lidas' AND EXISTS (SELECT 1 FROM public.publicacoes_djen_leituras l WHERE l.publicacao_id = r.id AND l.tabela_origem = r.tipo_origem AND l.usuario_id = v_uid))
  )
  SELECT f.id, f.tipo_origem, f.processo_id, f.processo_numero, f.conteudo, f.data_publicacao, f.data_disponibilizacao,
    f.fonte, f.lida, f.created_at, f.monitoramento_id, f.monitoramento_termo, f.monitoramento_descricao,
    f.monitoramento_tipo, f.monitoramento_oab, f.monitoramento_uf, f.coordenacao_id, f.coordenacao_nome,
    f.polo_ativo, f.polo_passivo, f.tribunal, f.orgao, f.tipo_comunicacao, f.meio, f.advogados_json, f.partes_json
  FROM filtered f
  ORDER BY f.created_at DESC
  LIMIT GREATEST(p_limit, 1)
  OFFSET GREATEST(p_offset, 0);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_djen_publicacoes_unificadas(uuid, timestamptz, timestamptz, boolean, text, integer, integer, uuid, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_djen_stats_per_user(
  p_coordenacao_id uuid DEFAULT NULL,
  p_inicio timestamptz DEFAULT NULL,
  p_fim timestamptz DEFAULT NULL,
  p_tipo_origem text DEFAULT NULL,
  p_search_query text DEFAULT NULL,
  p_monitoramento_id uuid DEFAULT NULL
)
RETURNS TABLE(total_termos bigint, total_processos bigint, nao_lidas_termos bigint, nao_lidas_processos bigint)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_q text;
  v_q_digits text;
  v_tipo text;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not authenticated' USING ERRCODE = '28000'; END IF;
  IF p_coordenacao_id IS NOT NULL AND NOT public.is_admin_or_coordenador(v_uid)
     AND NOT EXISTS (SELECT 1 FROM public.membros_coordenacao mc WHERE mc.coordenacao_id = p_coordenacao_id AND mc.usuario_id = v_uid)
  THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;

  v_tipo := NULLIF(btrim(COALESCE(p_tipo_origem, '')), '');
  IF v_tipo = 'todos' THEN v_tipo := NULL; END IF;
  v_q := NULLIF(btrim(p_search_query), '');
  v_q_digits := CASE WHEN v_q IS NOT NULL THEN regexp_replace(v_q, '[^0-9]', '', 'g') ELSE NULL END;
  IF v_q_digits IS NOT NULL AND length(v_q_digits) < 5 THEN v_q_digits := NULL; END IF;

  RETURN QUERY
  WITH base AS (
    SELECT pd.id, 'termo'::text AS tipo_origem,
      (pd.coordenacao_id::text || '|' || regexp_replace(COALESCE(pd.processo_numero, ''), '[^0-9]', '', 'g')
        || '|' || COALESCE(to_char(pd.data_disponibilizacao::date, 'YYYY-MM-DD'), to_char(pd.data_publicacao::date, 'YYYY-MM-DD'), to_char(pd.created_at::date, 'YYYY-MM-DD'))
        || '|' || left(lower(regexp_replace(regexp_replace(regexp_replace(COALESCE(public.strip_destinatarios(pd.conteudo), ''), '<[^>]*>', ' ', 'g'), '[^\w\s]', ' ', 'g'), '\s+', ' ', 'g')), 300)
      ) AS dedup_key,
      pd.created_at,
      CASE WHEN md.tipo = 'parte' THEN 0 ELSE 1 END AS prio
    FROM public.publicacoes_djen pd
    JOIN public.monitoramentos_djen md ON md.id = pd.monitoramento_id
    WHERE (p_coordenacao_id IS NULL OR pd.coordenacao_id = p_coordenacao_id)
      AND (v_tipo IS NULL OR v_tipo IN ('termo', 'parte'))
      AND (v_tipo IS DISTINCT FROM 'parte' OR md.tipo = 'parte')
      AND (p_monitoramento_id IS NULL OR pd.monitoramento_id = p_monitoramento_id)
      AND (p_inicio IS NULL OR pd.created_at >= p_inicio)
      AND (p_fim IS NULL OR pd.created_at <= p_fim)
      AND (v_q IS NULL OR pd.conteudo ILIKE ('%' || v_q || '%') OR pd.processo_numero ILIKE ('%' || v_q || '%') OR md.termo_busca ILIKE ('%' || v_q || '%') OR (v_q_digits IS NOT NULL AND regexp_replace(COALESCE(pd.processo_numero, ''), '[^0-9]', '', 'g') LIKE ('%' || v_q_digits || '%')))

    UNION ALL

    SELECT pdp.id, 'processo'::text AS tipo_origem,
      (pdp.coordenacao_id::text || '|' || regexp_replace(COALESCE(pdp.processo_numero, ''), '[^0-9]', '', 'g')
        || '|' || COALESCE(to_char(pdp.data_disponibilizacao::date, 'YYYY-MM-DD'), to_char(pdp.data_publicacao::date, 'YYYY-MM-DD'), to_char(pdp.created_at::date, 'YYYY-MM-DD'))
        || '|' || left(lower(regexp_replace(regexp_replace(regexp_replace(COALESCE(public.strip_destinatarios(pdp.conteudo), ''), '<[^>]*>', ' ', 'g'), '[^\w\s]', ' ', 'g'), '\s+', ' ', 'g')), 300)
      ) AS dedup_key,
      pdp.created_at,
      2 AS prio
    FROM public.publicacoes_djen_processos pdp
    LEFT JOIN public.processos pr ON pr.id = pdp.processo_id
    WHERE (p_coordenacao_id IS NULL OR pdp.coordenacao_id = p_coordenacao_id)
      AND (v_tipo IS NULL OR v_tipo = 'processo')
      AND p_monitoramento_id IS NULL
      AND (p_inicio IS NULL OR pdp.created_at >= p_inicio)
      AND (p_fim IS NULL OR pdp.created_at <= p_fim)
      AND (v_q IS NULL OR pdp.conteudo ILIKE ('%' || v_q || '%') OR pdp.processo_numero ILIKE ('%' || v_q || '%') OR COALESCE(pr.polo_ativo, '') ILIKE ('%' || v_q || '%') OR COALESCE(pr.polo_passivo, '') ILIKE ('%' || v_q || '%') OR (v_q_digits IS NOT NULL AND regexp_replace(COALESCE(pdp.processo_numero, ''), '[^0-9]', '', 'g') LIKE ('%' || v_q_digits || '%')))
  ),
  ranked AS (
    SELECT DISTINCT ON (b.dedup_key) b.id, b.tipo_origem, b.created_at
    FROM base b
    ORDER BY b.dedup_key, b.prio, b.created_at DESC
  )
  SELECT
    COUNT(*) FILTER (WHERE r.tipo_origem = 'termo')::bigint,
    COUNT(*) FILTER (WHERE r.tipo_origem = 'processo')::bigint,
    COUNT(*) FILTER (WHERE r.tipo_origem = 'termo' AND NOT EXISTS (SELECT 1 FROM public.publicacoes_djen_leituras l WHERE l.publicacao_id = r.id AND l.tabela_origem = r.tipo_origem AND l.usuario_id = v_uid))::bigint,
    COUNT(*) FILTER (WHERE r.tipo_origem = 'processo' AND NOT EXISTS (SELECT 1 FROM public.publicacoes_djen_leituras l WHERE l.publicacao_id = r.id AND l.tabela_origem = r.tipo_origem AND l.usuario_id = v_uid))::bigint
  FROM ranked r;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_djen_stats_per_user(uuid, timestamptz, timestamptz, text, text, uuid) TO authenticated;