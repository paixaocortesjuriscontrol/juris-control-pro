-- Optimize get_djen_stats_per_user to avoid statement timeout when querying with no filters.
-- Removes the expensive HTML-stripping/regexp on conteudo from the dedup key,
-- using only (coordenacao_id, processo_numero_digits, date) which is dramatically faster
-- and still produces accurate dedup for header totals.
CREATE OR REPLACE FUNCTION public.get_djen_stats_per_user(
  p_coordenacao_id uuid DEFAULT NULL::uuid,
  p_inicio timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_fim timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_tipo_origem text DEFAULT NULL::text,
  p_search_query text DEFAULT NULL::text,
  p_monitoramento_id uuid DEFAULT NULL::uuid
)
RETURNS TABLE(total_termos bigint, total_processos bigint, nao_lidas_termos bigint, nao_lidas_processos bigint)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
$function$;