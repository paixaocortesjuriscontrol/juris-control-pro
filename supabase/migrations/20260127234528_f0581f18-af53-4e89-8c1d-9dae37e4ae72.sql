-- RPC: listar publicações DJEN unificadas e deduplicadas (TERMO + PROCESSO) com paginação
-- OBS: aceita janela por timestamptz para respeitar corretamente o "Hoje" (ex: UTC-3 => 03:00Z..)

CREATE OR REPLACE FUNCTION public.get_djen_publicacoes_unificadas(
  p_coordenacao_id uuid,
  p_inicio timestamptz,
  p_fim timestamptz,
  p_apenas_nao_lidas boolean DEFAULT false,
  p_search_query text DEFAULT NULL,
  p_limit integer DEFAULT 200,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  tipo_origem text,
  processo_id uuid,
  processo_numero text,
  conteudo text,
  data_publicacao timestamptz,
  data_disponibilizacao timestamptz,
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
  tribunal text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid;
  v_q text;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '28000';
  END IF;

  IF p_coordenacao_id IS NULL THEN
    RAISE EXCEPTION 'coordenacao_id is required' USING ERRCODE = '22004';
  END IF;

  -- RBAC: admin/coordenador pode ver; membro também
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

  RETURN QUERY
  WITH
    base AS (
      -- TERMO
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
        -- dedup key (mesma regra do frontend/backend)
        (
          md.coordenacao_id::text
          || '|' || regexp_replace(COALESCE(pd.processo_numero, ''), '[^0-9]', '', 'g')
          || '|' || COALESCE(
            to_char(pd.data_publicacao::date, 'YYYY-MM-DD'),
            to_char(pd.data_disponibilizacao::date, 'YYYY-MM-DD'),
            to_char(pd.created_at::date, 'YYYY-MM-DD')
          )
          || '|' || left(
            lower(
              regexp_replace(
                regexp_replace(
                  regexp_replace(COALESCE(pd.conteudo, ''), '<[^>]*>', ' ', 'g'),
                  '[^\w\s]', ' ', 'g'
                ),
                '\s+', ' ', 'g'
              )
            ),
            300
          )
        ) AS dedup_key
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
        )

      UNION ALL

      -- PROCESSO
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
        (
          p.coordenacao_id::text
          || '|' || regexp_replace(COALESCE(pdp.processo_numero, ''), '[^0-9]', '', 'g')
          || '|' || COALESCE(
            to_char(pdp.data_publicacao::date, 'YYYY-MM-DD'),
            to_char(pdp.data_disponibilizacao::date, 'YYYY-MM-DD'),
            to_char(pdp.created_at::date, 'YYYY-MM-DD')
          )
          || '|' || left(
            lower(
              regexp_replace(
                regexp_replace(
                  regexp_replace(COALESCE(pdp.conteudo, ''), '<[^>]*>', ' ', 'g'),
                  '[^\w\s]', ' ', 'g'
                ),
                '\s+', ' ', 'g'
              )
            ),
            300
          )
        ) AS dedup_key
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
        )
    ),
    ranked AS (
      SELECT
        b.*,
        row_number() OVER (PARTITION BY b.dedup_key ORDER BY b.created_at DESC) AS rn
      FROM base b
    )
  SELECT
    r.id,
    r.tipo_origem,
    r.processo_id,
    r.processo_numero,
    r.conteudo,
    r.data_publicacao,
    r.data_disponibilizacao,
    r.fonte,
    r.lida,
    r.created_at,
    r.monitoramento_id,
    r.monitoramento_termo,
    r.monitoramento_descricao,
    r.monitoramento_tipo,
    r.monitoramento_oab,
    r.monitoramento_uf,
    r.coordenacao_id,
    r.coordenacao_nome,
    r.polo_ativo,
    r.polo_passivo,
    r.tribunal
  FROM ranked r
  WHERE r.rn = 1
  ORDER BY r.created_at DESC
  LIMIT GREATEST(p_limit, 1)
  OFFSET GREATEST(p_offset, 0);
END;
$$;


CREATE OR REPLACE FUNCTION public.count_djen_publicacoes_unificadas(
  p_coordenacao_id uuid,
  p_inicio timestamptz,
  p_fim timestamptz,
  p_apenas_nao_lidas boolean DEFAULT false,
  p_search_query text DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid;
  v_q text;
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

  WITH djen_union AS (
    SELECT
      md.coordenacao_id,
      regexp_replace(COALESCE(pd.processo_numero, ''), '[^0-9]', '', 'g') AS processo_digits,
      COALESCE(
        to_char(pd.data_publicacao::date, 'YYYY-MM-DD'),
        to_char(pd.data_disponibilizacao::date, 'YYYY-MM-DD'),
        to_char(pd.created_at::date, 'YYYY-MM-DD')
      ) AS data_ref,
      left(
        lower(
          regexp_replace(
            regexp_replace(
              regexp_replace(COALESCE(pd.conteudo, ''), '<[^>]*>', ' ', 'g'),
              '[^\w\s]', ' ', 'g'
            ),
            '\s+', ' ', 'g'
          )
        ),
        300
      ) AS head_norm
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
      left(
        lower(
          regexp_replace(
            regexp_replace(
              regexp_replace(COALESCE(pdp.conteudo, ''), '<[^>]*>', ' ', 'g'),
              '[^\w\s]', ' ', 'g'
            ),
            '\s+', ' ', 'g'
          )
        ),
        300
      ) AS head_norm
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
