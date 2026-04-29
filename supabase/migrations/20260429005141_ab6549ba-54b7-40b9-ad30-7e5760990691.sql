CREATE OR REPLACE FUNCTION public.get_djen_stats_per_user(
  p_coordenacao_id uuid DEFAULT NULL,
  p_inicio timestamp with time zone DEFAULT NULL,
  p_fim timestamp with time zone DEFAULT NULL,
  p_tipo_origem text DEFAULT NULL,
  p_search_query text DEFAULT NULL,
  p_monitoramento_id uuid DEFAULT NULL
)
RETURNS TABLE(
  total_termos bigint,
  total_processos bigint,
  nao_lidas_termos bigint,
  nao_lidas_processos bigint
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout = '20s'
AS $function$
DECLARE
  v_uid uuid;
  v_q text;
  v_q_digits text;
  v_tipo text;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '28000';
  END IF;

  IF p_coordenacao_id IS NOT NULL
     AND NOT public.is_admin_or_coordenador(v_uid)
     AND NOT EXISTS (
       SELECT 1 FROM public.membros_coordenacao mc
       WHERE mc.coordenacao_id = p_coordenacao_id AND mc.usuario_id = v_uid
     )
  THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  v_tipo := NULLIF(btrim(COALESCE(p_tipo_origem, '')), '');
  IF v_tipo = 'todos' THEN v_tipo := NULL; END IF;

  v_q := NULLIF(btrim(COALESCE(p_search_query, '')), '');
  v_q_digits := CASE WHEN v_q IS NOT NULL THEN regexp_replace(v_q, '[^0-9]', '', 'g') ELSE NULL END;
  IF v_q_digits IS NOT NULL AND length(v_q_digits) < 5 THEN v_q_digits := NULL; END IF;

  RETURN QUERY
  WITH
  -- Termos: agora usa dedup_key persistido (índice idx_publicacoes_djen_dedup_key)
  pt AS (
    SELECT DISTINCT ON (pd.dedup_key)
      pd.id,
      pd.dedup_key
    FROM public.publicacoes_djen pd
    WHERE (p_coordenacao_id IS NULL OR pd.coordenacao_id = p_coordenacao_id)
      AND (v_tipo IS NULL OR v_tipo IN ('termo', 'parte'))
      AND (p_monitoramento_id IS NULL OR pd.monitoramento_id = p_monitoramento_id)
      AND (p_inicio IS NULL OR pd.created_at >= p_inicio)
      AND (p_fim    IS NULL OR pd.created_at <= p_fim)
      AND (
        v_tipo IS DISTINCT FROM 'parte'
        OR EXISTS (
          SELECT 1 FROM public.monitoramentos_djen md
          WHERE md.id = pd.monitoramento_id AND md.tipo = 'parte'
        )
      )
      AND (
        v_q IS NULL
        OR pd.processo_numero ILIKE ('%' || v_q || '%')
        OR (v_q_digits IS NOT NULL
            AND regexp_replace(COALESCE(pd.processo_numero, ''), '[^0-9]', '', 'g') LIKE ('%' || v_q_digits || '%'))
        OR pd.conteudo ILIKE ('%' || v_q || '%')
      )
    ORDER BY pd.dedup_key, pd.created_at DESC
  ),
  pp AS (
    SELECT DISTINCT ON (pdp.dedup_key)
      pdp.id,
      pdp.dedup_key
    FROM public.publicacoes_djen_processos pdp
    WHERE (p_coordenacao_id IS NULL OR pdp.coordenacao_id = p_coordenacao_id)
      AND (v_tipo IS NULL OR v_tipo = 'processo')
      AND p_monitoramento_id IS NULL
      AND (p_inicio IS NULL OR pdp.created_at >= p_inicio)
      AND (p_fim    IS NULL OR pdp.created_at <= p_fim)
      AND (
        v_q IS NULL
        OR pdp.processo_numero ILIKE ('%' || v_q || '%')
        OR (v_q_digits IS NOT NULL
            AND regexp_replace(COALESCE(pdp.processo_numero, ''), '[^0-9]', '', 'g') LIKE ('%' || v_q_digits || '%'))
        OR pdp.conteudo ILIKE ('%' || v_q || '%')
      )
    ORDER BY pdp.dedup_key, pdp.created_at DESC
  )
  SELECT
    (SELECT COUNT(*) FROM pt)::bigint AS total_termos,
    (SELECT COUNT(*) FROM pp)::bigint AS total_processos,
    (SELECT COUNT(*) FROM pt
       WHERE NOT EXISTS (
         SELECT 1 FROM public.publicacoes_djen_leituras l
         WHERE l.publicacao_id = pt.id
           AND l.tabela_origem = 'termo'
           AND l.usuario_id = v_uid
       )
    )::bigint AS nao_lidas_termos,
    (SELECT COUNT(*) FROM pp
       WHERE NOT EXISTS (
         SELECT 1 FROM public.publicacoes_djen_leituras l
         WHERE l.publicacao_id = pp.id
           AND l.tabela_origem = 'processo'
           AND l.usuario_id = v_uid
       )
    )::bigint AS nao_lidas_processos;
END;
$function$;