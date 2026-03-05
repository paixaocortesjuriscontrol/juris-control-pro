
-- Optimized: limit cross-table matching to recent records only
CREATE OR REPLACE FUNCTION public.marcar_publicacoes_lidas_por_dedup(
  p_ids_termos uuid[] DEFAULT NULL::uuid[],
  p_ids_processos uuid[] DEFAULT NULL::uuid[],
  p_ids_descartadas uuid[] DEFAULT NULL::uuid[]
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_termos_atualizados int := 0;
  v_processos_atualizados int := 0;
  v_descartadas_atualizados int := 0;
  v_min_date timestamptz;
  v_max_date timestamptz;
BEGIN
  -- =========================================================
  -- STEP 1: Find date range from input IDs to limit scan scope
  -- =========================================================
  
  -- Get date bounds from termos
  IF p_ids_termos IS NOT NULL AND array_length(p_ids_termos, 1) > 0 THEN
    SELECT MIN(p.created_at) - interval '2 days', MAX(p.created_at) + interval '2 days'
    INTO v_min_date, v_max_date
    FROM publicacoes_djen p WHERE p.id = ANY(p_ids_termos);
  END IF;

  -- Expand bounds with processos
  IF p_ids_processos IS NOT NULL AND array_length(p_ids_processos, 1) > 0 THEN
    SELECT
      LEAST(v_min_date, MIN(pp.created_at) - interval '2 days'),
      GREATEST(v_max_date, MAX(pp.created_at) + interval '2 days')
    INTO v_min_date, v_max_date
    FROM publicacoes_djen_processos pp WHERE pp.id = ANY(p_ids_processos);
  END IF;

  -- Fallback if no date range found
  IF v_min_date IS NULL THEN
    v_min_date := now() - interval '7 days';
    v_max_date := now() + interval '1 day';
  END IF;

  -- =========================================================
  -- STEP 2: Collect dedup keys from input IDs
  -- =========================================================
  CREATE TEMP TABLE _dedup_keys (dedup_key text NOT NULL) ON COMMIT DROP;

  IF p_ids_termos IS NOT NULL AND array_length(p_ids_termos, 1) > 0 THEN
    INSERT INTO _dedup_keys (dedup_key)
    SELECT DISTINCT
      m.coordenacao_id::text || '|' ||
      regexp_replace(COALESCE(p.processo_numero, ''), '[^0-9]', '', 'g') || '|' ||
      COALESCE(
        to_char(p.data_publicacao::date, 'YYYY-MM-DD'),
        to_char(p.data_disponibilizacao::date, 'YYYY-MM-DD'),
        to_char(p.created_at::date, 'YYYY-MM-DD')
      ) || '|' ||
      left(lower(regexp_replace(regexp_replace(regexp_replace(
        COALESCE(public.strip_destinatarios(p.conteudo), ''), '<[^>]*>', ' ', 'g'
      ), '[^\w\s]', ' ', 'g'), '\s+', ' ', 'g')), 300)
    FROM publicacoes_djen p
    JOIN monitoramentos_djen m ON m.id = p.monitoramento_id
    WHERE p.id = ANY(p_ids_termos);
  END IF;

  IF p_ids_processos IS NOT NULL AND array_length(p_ids_processos, 1) > 0 THEN
    INSERT INTO _dedup_keys (dedup_key)
    SELECT DISTINCT
      pr.coordenacao_id::text || '|' ||
      regexp_replace(COALESCE(pp.processo_numero, ''), '[^0-9]', '', 'g') || '|' ||
      COALESCE(
        to_char(pp.data_publicacao::date, 'YYYY-MM-DD'),
        to_char(pp.data_disponibilizacao::date, 'YYYY-MM-DD'),
        to_char(pp.created_at::date, 'YYYY-MM-DD')
      ) || '|' ||
      left(lower(regexp_replace(regexp_replace(regexp_replace(
        COALESCE(public.strip_destinatarios(pp.conteudo), ''), '<[^>]*>', ' ', 'g'
      ), '[^\w\s]', ' ', 'g'), '\s+', ' ', 'g')), 300)
    FROM publicacoes_djen_processos pp
    JOIN processos pr ON pr.id = pp.processo_id
    WHERE pp.id = ANY(p_ids_processos);
  END IF;

  -- =========================================================
  -- STEP 3: Mark matching in publicacoes_djen (scoped by date)
  -- =========================================================
  IF EXISTS (SELECT 1 FROM _dedup_keys LIMIT 1) THEN
    WITH matching AS (
      SELECT p.id
      FROM publicacoes_djen p
      JOIN monitoramentos_djen m ON m.id = p.monitoramento_id
      WHERE p.lida = false
        AND p.created_at >= v_min_date
        AND p.created_at <= v_max_date
        AND (
          m.coordenacao_id::text || '|' ||
          regexp_replace(COALESCE(p.processo_numero, ''), '[^0-9]', '', 'g') || '|' ||
          COALESCE(
            to_char(p.data_publicacao::date, 'YYYY-MM-DD'),
            to_char(p.data_disponibilizacao::date, 'YYYY-MM-DD'),
            to_char(p.created_at::date, 'YYYY-MM-DD')
          ) || '|' ||
          left(lower(regexp_replace(regexp_replace(regexp_replace(
            COALESCE(public.strip_destinatarios(p.conteudo), ''), '<[^>]*>', ' ', 'g'
          ), '[^\w\s]', ' ', 'g'), '\s+', ' ', 'g')), 300)
        ) IN (SELECT DISTINCT dedup_key FROM _dedup_keys)
    )
    UPDATE publicacoes_djen SET lida = true
    WHERE id IN (SELECT id FROM matching);
    GET DIAGNOSTICS v_termos_atualizados = ROW_COUNT;

    -- Cross-mark in publicacoes_djen_processos (scoped by date)
    WITH matching AS (
      SELECT pp.id
      FROM publicacoes_djen_processos pp
      JOIN processos pr ON pr.id = pp.processo_id
      WHERE pp.lida = false
        AND pp.created_at >= v_min_date
        AND pp.created_at <= v_max_date
        AND (
          pr.coordenacao_id::text || '|' ||
          regexp_replace(COALESCE(pp.processo_numero, ''), '[^0-9]', '', 'g') || '|' ||
          COALESCE(
            to_char(pp.data_publicacao::date, 'YYYY-MM-DD'),
            to_char(pp.data_disponibilizacao::date, 'YYYY-MM-DD'),
            to_char(pp.created_at::date, 'YYYY-MM-DD')
          ) || '|' ||
          left(lower(regexp_replace(regexp_replace(regexp_replace(
            COALESCE(public.strip_destinatarios(pp.conteudo), ''), '<[^>]*>', ' ', 'g'
          ), '[^\w\s]', ' ', 'g'), '\s+', ' ', 'g')), 300)
        ) IN (SELECT DISTINCT dedup_key FROM _dedup_keys)
    )
    UPDATE publicacoes_djen_processos SET lida = true
    WHERE id IN (SELECT id FROM matching);
    GET DIAGNOSTICS v_processos_atualizados = ROW_COUNT;
  END IF;

  -- =========================================================
  -- STEP 4: Descartadas (independent)
  -- =========================================================
  IF p_ids_descartadas IS NOT NULL AND array_length(p_ids_descartadas, 1) > 0 THEN
    WITH dedup_keys_desc AS (
      SELECT DISTINCT
        m.coordenacao_id::text || '|' ||
        regexp_replace(COALESCE(d.processo_numero, ''), '[^0-9]', '', 'g') || '|' ||
        COALESCE(
          to_char(d.data_publicacao::date, 'YYYY-MM-DD'),
          to_char(d.created_at::date, 'YYYY-MM-DD')
        ) || '|' ||
        left(lower(regexp_replace(regexp_replace(regexp_replace(
          COALESCE(public.strip_destinatarios(d.conteudo), ''), '<[^>]*>', ' ', 'g'
        ), '[^\w\s]', ' ', 'g'), '\s+', ' ', 'g')), 300) AS dedup_key,
        d.created_at
      FROM publicacoes_djen_descartadas d
      JOIN monitoramentos_djen m ON m.id = d.monitoramento_id
      WHERE d.id = ANY(p_ids_descartadas)
    ),
    date_range AS (
      SELECT MIN(created_at) - interval '2 days' AS d_min, MAX(created_at) + interval '2 days' AS d_max
      FROM dedup_keys_desc
    ),
    all_matching AS (
      SELECT d.id
      FROM publicacoes_djen_descartadas d
      JOIN monitoramentos_djen m ON m.id = d.monitoramento_id
      CROSS JOIN date_range dr
      WHERE d.lida = false
        AND d.created_at >= dr.d_min
        AND d.created_at <= dr.d_max
        AND (
          m.coordenacao_id::text || '|' ||
          regexp_replace(COALESCE(d.processo_numero, ''), '[^0-9]', '', 'g') || '|' ||
          COALESCE(
            to_char(d.data_publicacao::date, 'YYYY-MM-DD'),
            to_char(d.created_at::date, 'YYYY-MM-DD')
          ) || '|' ||
          left(lower(regexp_replace(regexp_replace(regexp_replace(
            COALESCE(public.strip_destinatarios(d.conteudo), ''), '<[^>]*>', ' ', 'g'
          ), '[^\w\s]', ' ', 'g'), '\s+', ' ', 'g')), 300)
        ) IN (SELECT dedup_key FROM dedup_keys_desc)
    )
    UPDATE publicacoes_djen_descartadas SET lida = true
    WHERE id IN (SELECT id FROM all_matching);
    GET DIAGNOSTICS v_descartadas_atualizados = ROW_COUNT;
  END IF;

  RETURN json_build_object(
    'termos_atualizados', v_termos_atualizados,
    'processos_atualizados', v_processos_atualizados,
    'descartadas_atualizados', v_descartadas_atualizados
  );
END;
$function$;
