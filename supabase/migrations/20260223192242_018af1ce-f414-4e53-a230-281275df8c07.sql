
-- Force PostgREST to re-discover functions by recreating them
-- This is a no-op on logic but forces schema cache invalidation

CREATE OR REPLACE FUNCTION public.count_djen_publicacoes_unificadas(
  p_coordenacao_id uuid,
  p_inicio timestamptz DEFAULT NULL,
  p_fim timestamptz DEFAULT NULL,
  p_apenas_nao_lidas boolean DEFAULT false,
  p_search_query text DEFAULT NULL,
  p_monitoramento_id uuid DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid;
  v_q text;
  v_q_digits text;
  v_count integer;
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
       SELECT 1
       FROM public.membros_coordenacao mc
       WHERE mc.coordenacao_id = p_coordenacao_id
         AND mc.usuario_id = v_uid
     )
  THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  v_q := NULLIF(btrim(p_search_query), '');
  v_q_digits := CASE WHEN v_q IS NOT NULL THEN regexp_replace(v_q, '[^0-9]', '', 'g') ELSE NULL END;
  IF v_q_digits IS NOT NULL AND length(v_q_digits) < 5 THEN
    v_q_digits := NULL;
  END IF;

  WITH djen_union AS (
    SELECT
      md.coordenacao_id,
      regexp_replace(COALESCE(pd.processo_numero, ''), '[^0-9]', '', 'g') AS processo_digits,
      COALESCE(
        to_char(pd.data_publicacao::date, 'YYYY-MM-DD'),
        to_char(pd.data_disponibilizacao::date, 'YYYY-MM-DD'),
        to_char(pd.created_at::date, 'YYYY-MM-DD')
      ) AS data_ref,
      left(lower(regexp_replace(regexp_replace(regexp_replace(COALESCE(pd.conteudo, ''), '<[^>]*>', ' ', 'g'), '[^\w\s]', ' ', 'g'), '\s+', ' ', 'g')), 300) AS head_norm
    FROM public.publicacoes_djen pd
    JOIN public.monitoramentos_djen md ON md.id = pd.monitoramento_id
    WHERE md.coordenacao_id = p_coordenacao_id
      AND (p_inicio IS NULL OR pd.created_at >= p_inicio)
      AND (p_fim IS NULL OR pd.created_at <= p_fim)
      AND (NOT p_apenas_nao_lidas OR pd.lida = false)
      AND (
        v_q IS NULL
        OR pd.conteudo ILIKE ('%' || v_q || '%')
        OR pd.processo_numero ILIKE ('%' || v_q || '%')
        OR md.termo_busca ILIKE ('%' || v_q || '%')
        OR (v_q_digits IS NOT NULL AND regexp_replace(COALESCE(pd.processo_numero, ''), '[^0-9]', '', 'g') LIKE ('%' || v_q_digits || '%'))
      )

    UNION ALL

    SELECT
      p.coordenacao_id,
      regexp_replace(COALESCE(pdp.processo_numero, ''), '[^0-9]', '', 'g') AS processo_digits,
      COALESCE(
        to_char(pdp.data_publicacao::date, 'YYYY-MM-DD'),
        to_char(pdp.data_disponibilizacao::date, 'YYYY-MM-DD'),
        to_char(pdp.created_at::date, 'YYYY-MM-DD')
      ) AS data_ref,
      left(lower(regexp_replace(regexp_replace(regexp_replace(COALESCE(pdp.conteudo, ''), '<[^>]*>', ' ', 'g'), '[^\w\s]', ' ', 'g'), '\s+', ' ', 'g')), 300) AS head_norm
    FROM public.publicacoes_djen_processos pdp
    JOIN public.processos p ON p.id = pdp.processo_id
    WHERE p.coordenacao_id = p_coordenacao_id
      AND (p_inicio IS NULL OR pdp.created_at >= p_inicio)
      AND (p_fim IS NULL OR pdp.created_at <= p_fim)
      AND (NOT p_apenas_nao_lidas OR pdp.lida = false)
      AND (
        v_q IS NULL
        OR pdp.conteudo ILIKE ('%' || v_q || '%')
        OR pdp.processo_numero ILIKE ('%' || v_q || '%')
        OR COALESCE(p.polo_ativo, '') ILIKE ('%' || v_q || '%')
        OR COALESCE(p.polo_passivo, '') ILIKE ('%' || v_q || '%')
        OR (v_q_digits IS NOT NULL AND regexp_replace(COALESCE(pdp.processo_numero, ''), '[^0-9]', '', 'g') LIKE ('%' || v_q_digits || '%'))
      )
  )
  SELECT COUNT(DISTINCT
    du.coordenacao_id::text || '|' || du.processo_digits || '|' || du.data_ref || '|' || du.head_norm
  )::int
  INTO v_count
  FROM djen_union du;

  RETURN COALESCE(v_count, 0);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_djen_publicacoes_unificadas(
  p_coordenacao_id uuid,
  p_inicio timestamptz DEFAULT NULL,
  p_fim timestamptz DEFAULT NULL,
  p_apenas_nao_lidas boolean DEFAULT false,
  p_search_query text DEFAULT NULL,
  p_limit integer DEFAULT 200,
  p_offset integer DEFAULT 0,
  p_monitoramento_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  tipo_origem text,
  processo_id uuid,
  processo_numero text,
  conteudo text,
  data_publicacao text,
  data_disponibilizacao text,
  fonte text,
  lida boolean,
  created_at timestamptz,
  monitoramento_id uuid,
  monitoramento_termo text,
  monitoramento_descricao text,
  monitoramento_tipo text,
  monitoramento_oab text,
  monitoramento_uf text,
  coordenacao_id uuid,
  coordenacao_nome text,
  polo_ativo text,
  polo_passivo text,
  tribunal text,
  orgao text,
  tipo_comunicacao text,
  meio text,
  advogados_json jsonb,
  partes_json jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid;
  v_q text;
  v_q_digits text;
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
       SELECT 1
       FROM public.membros_coordenacao mc
       WHERE mc.coordenacao_id = p_coordenacao_id
         AND mc.usuario_id = v_uid
     )
  THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  v_q := NULLIF(btrim(p_search_query), '');
  v_q_digits := CASE WHEN v_q IS NOT NULL THEN regexp_replace(v_q, '[^0-9]', '', 'g') ELSE NULL END;
  IF v_q_digits IS NOT NULL AND length(v_q_digits) < 5 THEN
    v_q_digits := NULL;
  END IF;

  RETURN QUERY
  WITH
    base AS (
      SELECT
        pd.id,
        'termo'::text AS tipo_origem,
        NULL::uuid AS processo_id,
        pd.processo_numero,
        pd.conteudo,
        pd.data_publicacao,
        pd.data_disponibilizacao,
        pd.fonte,
        pd.lida,
        pd.created_at,
        pd.monitoramento_id,
        md.termo_busca AS monitoramento_termo,
        md.descricao AS monitoramento_descricao,
        md.tipo AS monitoramento_tipo,
        md.oab AS monitoramento_oab,
        md.uf AS monitoramento_uf,
        md.coordenacao_id,
        c.nome AS coordenacao_nome,
        NULL::text AS polo_ativo,
        NULL::text AS polo_passivo,
        NULL::text AS tribunal,
        pd.orgao,
        pd.tipo_comunicacao,
        pd.meio,
        pd.advogados_json,
        pd.partes_json,
        (
          md.coordenacao_id::text
          || '|' || regexp_replace(COALESCE(pd.processo_numero, ''), '[^0-9]', '', 'g')
          || '|' || COALESCE(
            to_char(pd.data_publicacao::date, 'YYYY-MM-DD'),
            to_char(pd.data_disponibilizacao::date, 'YYYY-MM-DD'),
            to_char(pd.created_at::date, 'YYYY-MM-DD')
          )
          || '|' || left(lower(regexp_replace(regexp_replace(regexp_replace(COALESCE(pd.conteudo, ''), '<[^>]*>', ' ', 'g'), '[^\w\s]', ' ', 'g'), '\s+', ' ', 'g')), 300)
        ) AS dedup_key,
        CASE WHEN p_monitoramento_id IS NOT NULL AND pd.monitoramento_id = p_monitoramento_id THEN 0 ELSE 1 END AS prio
      FROM public.publicacoes_djen pd
      JOIN public.monitoramentos_djen md ON md.id = pd.monitoramento_id
      JOIN public.coordenacoes c ON c.id = md.coordenacao_id
      WHERE md.coordenacao_id = p_coordenacao_id
        AND (p_inicio IS NULL OR pd.created_at >= p_inicio)
        AND (p_fim IS NULL OR pd.created_at <= p_fim)
        AND (NOT p_apenas_nao_lidas OR pd.lida = false)
        AND (
          v_q IS NULL
          OR pd.conteudo ILIKE ('%' || v_q || '%')
          OR pd.processo_numero ILIKE ('%' || v_q || '%')
          OR md.termo_busca ILIKE ('%' || v_q || '%')
          OR (v_q_digits IS NOT NULL AND regexp_replace(COALESCE(pd.processo_numero, ''), '[^0-9]', '', 'g') LIKE ('%' || v_q_digits || '%'))
        )

      UNION ALL

      SELECT
        pdp.id,
        'processo'::text AS tipo_origem,
        pdp.processo_id,
        pdp.processo_numero,
        pdp.conteudo,
        pdp.data_publicacao,
        pdp.data_disponibilizacao,
        pdp.fonte,
        pdp.lida,
        pdp.created_at,
        NULL::uuid AS monitoramento_id,
        NULL::text AS monitoramento_termo,
        NULL::text AS monitoramento_descricao,
        NULL::text AS monitoramento_tipo,
        NULL::text AS monitoramento_oab,
        NULL::text AS monitoramento_uf,
        p.coordenacao_id,
        c.nome AS coordenacao_nome,
        p.polo_ativo,
        p.polo_passivo,
        p.tribunal,
        pdp.orgao,
        pdp.tipo_comunicacao,
        pdp.meio,
        pdp.advogados_json,
        pdp.partes_json,
        (
          p.coordenacao_id::text
          || '|' || regexp_replace(COALESCE(pdp.processo_numero, ''), '[^0-9]', '', 'g')
          || '|' || COALESCE(
            to_char(pdp.data_publicacao::date, 'YYYY-MM-DD'),
            to_char(pdp.data_disponibilizacao::date, 'YYYY-MM-DD'),
            to_char(pdp.created_at::date, 'YYYY-MM-DD')
          )
          || '|' || left(lower(regexp_replace(regexp_replace(regexp_replace(COALESCE(pdp.conteudo, ''), '<[^>]*>', ' ', 'g'), '[^\w\s]', ' ', 'g'), '\s+', ' ', 'g')), 300)
        ) AS dedup_key,
        1 AS prio
      FROM public.publicacoes_djen_processos pdp
      JOIN public.processos p ON p.id = pdp.processo_id
      JOIN public.coordenacoes c ON c.id = p.coordenacao_id
      WHERE p.coordenacao_id = p_coordenacao_id
        AND (p_inicio IS NULL OR pdp.created_at >= p_inicio)
        AND (p_fim IS NULL OR pdp.created_at <= p_fim)
        AND (NOT p_apenas_nao_lidas OR pdp.lida = false)
        AND (
          v_q IS NULL
          OR pdp.conteudo ILIKE ('%' || v_q || '%')
          OR pdp.processo_numero ILIKE ('%' || v_q || '%')
          OR COALESCE(p.polo_ativo, '') ILIKE ('%' || v_q || '%')
          OR COALESCE(p.polo_passivo, '') ILIKE ('%' || v_q || '%')
          OR (v_q_digits IS NOT NULL AND regexp_replace(COALESCE(pdp.processo_numero, ''), '[^0-9]', '', 'g') LIKE ('%' || v_q_digits || '%'))
        )
    ),
    deduped AS (
      SELECT DISTINCT ON (dedup_key) *
      FROM base
      ORDER BY dedup_key, prio ASC, created_at DESC
    )
  SELECT
    d.id, d.tipo_origem, d.processo_id, d.processo_numero, d.conteudo,
    d.data_publicacao, d.data_disponibilizacao, d.fonte, d.lida, d.created_at,
    d.monitoramento_id, d.monitoramento_termo, d.monitoramento_descricao,
    d.monitoramento_tipo, d.monitoramento_oab, d.monitoramento_uf,
    d.coordenacao_id, d.coordenacao_nome, d.polo_ativo, d.polo_passivo, d.tribunal,
    d.orgao, d.tipo_comunicacao, d.meio, d.advogados_json, d.partes_json
  FROM deduped d
  ORDER BY d.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- Force schema reload
NOTIFY pgrst, 'reload schema';
