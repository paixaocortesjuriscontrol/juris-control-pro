
CREATE OR REPLACE FUNCTION public.descartar_duplicadas_coordenacao(
  p_coordenacao_id uuid,
  p_data_disp_inicio date DEFAULT NULL::date,
  p_data_disp_fim date DEFAULT NULL::date
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_user_nome text;
  v_lote_id uuid := gen_random_uuid();
  v_total integer := 0;
  v_count integer;
  v_data_inicio date;
  v_data_fim date;
  v_ts_inicio timestamptz;
  v_ts_fim_exclusive timestamptz;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  IF NOT (
    public.has_role(v_user_id, 'admin')
    OR EXISTS (
      SELECT 1
      FROM public.membros_coordenacao mc
      WHERE mc.usuario_id = v_user_id
        AND mc.coordenacao_id = p_coordenacao_id
    )
  ) THEN
    RAISE EXCEPTION 'Sem permissão para esta coordenação';
  END IF;

  -- Sem data preenchida: usa somente hoje em BRT.
  v_data_inicio := COALESCE(
    p_data_disp_inicio,
    p_data_disp_fim,
    (now() AT TIME ZONE 'America/Sao_Paulo')::date
  );
  v_data_fim := COALESCE(
    p_data_disp_fim,
    p_data_disp_inicio,
    (now() AT TIME ZONE 'America/Sao_Paulo')::date
  );

  v_ts_inicio := v_data_inicio::timestamp AT TIME ZONE 'America/Sao_Paulo';
  v_ts_fim_exclusive := (v_data_fim + 1)::timestamp AT TIME ZONE 'America/Sao_Paulo';

  SELECT COALESCE(pr.nome, pr.email, 'Usuário')
    INTO v_user_nome
  FROM public.profiles pr
  WHERE pr.id = v_user_id;

  CREATE TEMP TABLE IF NOT EXISTS _dup_ids (id uuid PRIMARY KEY) ON COMMIT DROP;
  TRUNCATE _dup_ids;

  INSERT INTO _dup_ids (id)
  WITH base AS MATERIALIZED (
    -- Ramo principal: publicações com coordenacao_id direto
    SELECT
      pd.id,
      pd.created_at,
      p_coordenacao_id AS coord_id,
      NULLIF(COALESCE(NULLIF(pd.dedup_processo_digits, ''), regexp_replace(COALESCE(pd.processo_numero, ''), '[^0-9]', '', 'g')), '') AS processo_digits,
      length(COALESCE(pd.conteudo, '')) AS conteudo_len,
      pd.conteudo
    FROM public.publicacoes_djen pd
    WHERE pd.coordenacao_id = p_coordenacao_id
      AND pd.status IN ('encontrada', 'duplicada')
      AND COALESCE(pd.data_publicacao, pd.data_disponibilizacao, pd.created_at) >= v_ts_inicio
      AND COALESCE(pd.data_publicacao, pd.data_disponibilizacao, pd.created_at) < v_ts_fim_exclusive

    UNION ALL

    -- Ramo legado: publicações sem coordenacao_id direto, ligadas por monitoramento
    SELECT
      pd.id,
      pd.created_at,
      p_coordenacao_id AS coord_id,
      NULLIF(COALESCE(NULLIF(pd.dedup_processo_digits, ''), regexp_replace(COALESCE(pd.processo_numero, ''), '[^0-9]', '', 'g')), '') AS processo_digits,
      length(COALESCE(pd.conteudo, '')) AS conteudo_len,
      pd.conteudo
    FROM public.monitoramentos_djen md
    JOIN public.publicacoes_djen pd ON pd.monitoramento_id = md.id
    WHERE md.coordenacao_id = p_coordenacao_id
      AND pd.coordenacao_id IS NULL
      AND pd.status IN ('encontrada', 'duplicada')
      AND COALESCE(pd.data_publicacao, pd.data_disponibilizacao, pd.created_at) >= v_ts_inicio
      AND COALESCE(pd.data_publicacao, pd.data_disponibilizacao, pd.created_at) < v_ts_fim_exclusive
  ), normalizados AS MATERIALIZED (
    SELECT
      b.id,
      b.created_at,
      b.coord_id,
      b.processo_digits,
      b.conteudo_len,
      NULLIF(public.djen_normalize_conteudo_descarte_sem_intimados(b.conteudo), '') AS conteudo_norm
    FROM base b
    WHERE b.processo_digits IS NOT NULL
  ), grupos AS MATERIALIZED (
    SELECT
      n.coord_id,
      n.processo_digits,
      n.conteudo_norm
    FROM normalizados n
    WHERE n.conteudo_norm IS NOT NULL
    GROUP BY n.coord_id, n.processo_digits, n.conteudo_norm
    HAVING COUNT(*) > 1
  ), ranked AS (
    SELECT
      n.id,
      ROW_NUMBER() OVER (
        PARTITION BY n.coord_id, n.processo_digits, n.conteudo_norm
        ORDER BY n.created_at ASC, n.id ASC
      ) AS rn
    FROM normalizados n
    JOIN grupos g
      ON g.coord_id = n.coord_id
     AND g.processo_digits = n.processo_digits
     AND g.conteudo_norm = n.conteudo_norm
  )
  SELECT r.id
  FROM ranked r
  WHERE r.rn > 1;

  INSERT INTO public.publicacoes_djen_descartadas (
    monitoramento_id, hash_conteudo, data_publicacao, processo_numero,
    conteudo, fonte, motivo_descarte, data_disponibilizacao, tribunal,
    lida, orgao, tipo_comunicacao, meio, partes_json, advogados_json,
    dedup_processo_digits, dedup_data_ref, dedup_head_norm, coordenacao_id, id_djen,
    descartado_por, descartado_por_nome, lote_descarte_id,
    tipo_origem_origem, id_origem, payload_origem
  )
  SELECT
    p.monitoramento_id, p.hash_conteudo, p.data_publicacao, p.processo_numero,
    p.conteudo, p.fonte, 'duplicada_mesmo_processo_conteudo_sem_intimados', p.data_disponibilizacao, p.tribunal,
    p.lida, p.orgao, p.tipo_comunicacao, p.meio, p.partes_json, p.advogados_json,
    p.dedup_processo_digits, p.dedup_data_ref, p.dedup_head_norm, COALESCE(p.coordenacao_id, p_coordenacao_id), p.id_djen,
    v_user_id, v_user_nome, v_lote_id,
    'djen', p.id, to_jsonb(p.*)
  FROM public.publicacoes_djen p
  JOIN _dup_ids d ON d.id = p.id;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_total := COALESCE(v_count, 0);

  DELETE FROM public.publicacoes_djen p
  USING _dup_ids d
  WHERE p.id = d.id;

  RETURN jsonb_build_object(
    'success', true,
    'total', v_total,
    'total_descartadas', v_total,
    'lote_id', v_lote_id,
    'descartado_por_nome', v_user_nome,
    'data_inicio', v_data_inicio,
    'data_fim', v_data_fim,
    'regra', 'mesma_coordenação + mesmo_processo + mesmo_conteúdo_sem_intimados'
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.descartar_duplicadas_coordenacao(uuid, date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.descartar_duplicadas_coordenacao(uuid, date, date) TO service_role;
