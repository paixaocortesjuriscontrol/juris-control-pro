CREATE OR REPLACE FUNCTION public.get_djen_stats_per_user(
  p_coordenacao_id uuid DEFAULT NULL,
  p_inicio timestamptz DEFAULT NULL,
  p_fim timestamptz DEFAULT NULL,
  p_tipo_origem text DEFAULT NULL,        -- 'termo' | 'parte' | 'processo' | NULL (todos)
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
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_q text;
  v_q_digits text;
  v_inc_termos boolean;
  v_inc_proc boolean;
  v_only_parte boolean;
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

  v_q := NULLIF(btrim(p_search_query), '');
  v_q_digits := CASE WHEN v_q IS NOT NULL THEN regexp_replace(v_q, '[^0-9]', '', 'g') ELSE NULL END;
  IF v_q_digits IS NOT NULL AND length(v_q_digits) < 5 THEN
    v_q_digits := NULL;
  END IF;

  v_only_parte := (p_tipo_origem = 'parte');
  v_inc_termos := (p_tipo_origem IS NULL OR p_tipo_origem IN ('termo','parte','todos'));
  v_inc_proc   := (p_tipo_origem IS NULL OR p_tipo_origem IN ('processo','todos'));

  RETURN QUERY
  WITH
    pt AS (
      SELECT pd.id
      FROM public.publicacoes_djen pd
      JOIN public.monitoramentos_djen md ON md.id = pd.monitoramento_id
      WHERE v_inc_termos
        AND (p_coordenacao_id IS NULL OR pd.coordenacao_id = p_coordenacao_id)
        AND (p_inicio IS NULL OR pd.created_at >= p_inicio)
        AND (p_fim    IS NULL OR pd.created_at <= p_fim)
        AND (p_monitoramento_id IS NULL OR pd.monitoramento_id = p_monitoramento_id)
        AND (NOT v_only_parte OR md.tipo = 'parte')
        AND (
          v_q IS NULL
          OR pd.conteudo ILIKE ('%' || v_q || '%')
          OR pd.processo_numero ILIKE ('%' || v_q || '%')
          OR md.termo_busca ILIKE ('%' || v_q || '%')
          OR (v_q_digits IS NOT NULL
              AND regexp_replace(COALESCE(pd.processo_numero, ''), '[^0-9]', '', 'g')
                  LIKE ('%' || v_q_digits || '%'))
        )
    ),
    pp AS (
      SELECT pdp.id
      FROM public.publicacoes_djen_processos pdp
      LEFT JOIN public.processos pr ON pr.id = pdp.processo_id
      WHERE v_inc_proc
        AND (p_coordenacao_id IS NULL OR pdp.coordenacao_id = p_coordenacao_id)
        AND (p_inicio IS NULL OR pdp.created_at >= p_inicio)
        AND (p_fim    IS NULL OR pdp.created_at <= p_fim)
        AND (
          v_q IS NULL
          OR pdp.conteudo ILIKE ('%' || v_q || '%')
          OR pdp.processo_numero ILIKE ('%' || v_q || '%')
          OR COALESCE(pr.polo_ativo, '') ILIKE ('%' || v_q || '%')
          OR COALESCE(pr.polo_passivo, '') ILIKE ('%' || v_q || '%')
          OR (v_q_digits IS NOT NULL
              AND regexp_replace(COALESCE(pdp.processo_numero, ''), '[^0-9]', '', 'g')
                  LIKE ('%' || v_q_digits || '%'))
        )
    )
  SELECT
    (SELECT count(*) FROM pt)::bigint AS total_termos,
    (SELECT count(*) FROM pp)::bigint AS total_processos,
    (SELECT count(*) FROM pt
       WHERE NOT EXISTS (
         SELECT 1 FROM public.publicacoes_djen_leituras l
         WHERE l.publicacao_id = pt.id
           AND l.tabela_origem = 'termo'
           AND l.usuario_id = v_uid
       )
    )::bigint AS nao_lidas_termos,
    (SELECT count(*) FROM pp
       WHERE NOT EXISTS (
         SELECT 1 FROM public.publicacoes_djen_leituras l
         WHERE l.publicacao_id = pp.id
           AND l.tabela_origem = 'processo'
           AND l.usuario_id = v_uid
       )
    )::bigint AS nao_lidas_processos;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_djen_stats_per_user(uuid, timestamptz, timestamptz, text, text, uuid) TO authenticated;