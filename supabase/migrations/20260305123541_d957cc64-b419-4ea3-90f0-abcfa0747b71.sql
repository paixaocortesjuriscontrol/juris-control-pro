
-- Fix: marcar_publicacoes_lidas_por_dedup agora faz cross-mark entre tabelas
-- Quando marca um registro em publicacoes_djen, também marca duplicatas em publicacoes_djen_processos e vice-versa
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
  v_cross_termos int := 0;
  v_cross_processos int := 0;
BEGIN
  -- =========================================================
  -- STEP 1: Collect ALL dedup keys from inputs (both tables)
  -- =========================================================
  CREATE TEMP TABLE _dedup_keys_all (dedup_key text NOT NULL) ON COMMIT DROP;

  -- Keys from termos input
  IF p_ids_termos IS NOT NULL AND array_length(p_ids_termos, 1) > 0 THEN
    INSERT INTO _dedup_keys_all (dedup_key)
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

  -- Keys from processos input
  IF p_ids_processos IS NOT NULL AND array_length(p_ids_processos, 1) > 0 THEN
    INSERT INTO _dedup_keys_all (dedup_key)
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
  -- STEP 2: Mark ALL matching records in BOTH tables using collected keys
  -- =========================================================

  -- Mark in publicacoes_djen (termos)
  IF EXISTS (SELECT 1 FROM _dedup_keys_all LIMIT 1) THEN
    WITH all_matching_termos AS (
      SELECT p.id
      FROM publicacoes_djen p
      JOIN monitoramentos_djen m ON m.id = p.monitoramento_id
      WHERE (
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
      ) IN (SELECT DISTINCT dedup_key FROM _dedup_keys_all)
        AND p.lida = false
    )
    UPDATE publicacoes_djen SET lida = true
    WHERE id IN (SELECT id FROM all_matching_termos);
    GET DIAGNOSTICS v_termos_atualizados = ROW_COUNT;

    -- Mark in publicacoes_djen_processos (cross-table)
    WITH all_matching_processos AS (
      SELECT pp.id
      FROM publicacoes_djen_processos pp
      JOIN processos pr ON pr.id = pp.processo_id
      WHERE (
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
      ) IN (SELECT DISTINCT dedup_key FROM _dedup_keys_all)
        AND pp.lida = false
    )
    UPDATE publicacoes_djen_processos SET lida = true
    WHERE id IN (SELECT id FROM all_matching_processos);
    GET DIAGNOSTICS v_cross_processos = ROW_COUNT;
    v_processos_atualizados := v_cross_processos;
  END IF;

  -- =========================================================
  -- STEP 3: Handle descartadas (independent, no cross-table)
  -- =========================================================
  IF p_ids_descartadas IS NOT NULL AND array_length(p_ids_descartadas, 1) > 0 THEN
    WITH dedup_keys AS (
      SELECT DISTINCT
        m.coordenacao_id::text || '|' ||
        regexp_replace(COALESCE(d.processo_numero, ''), '[^0-9]', '', 'g') || '|' ||
        COALESCE(
          to_char(d.data_publicacao::date, 'YYYY-MM-DD'),
          to_char(d.created_at::date, 'YYYY-MM-DD')
        ) || '|' ||
        left(lower(regexp_replace(regexp_replace(regexp_replace(
          COALESCE(public.strip_destinatarios(d.conteudo), ''), '<[^>]*>', ' ', 'g'
        ), '[^\w\s]', ' ', 'g'), '\s+', ' ', 'g')), 300) AS dedup_key
      FROM publicacoes_djen_descartadas d
      JOIN monitoramentos_djen m ON m.id = d.monitoramento_id
      WHERE d.id = ANY(p_ids_descartadas)
    ),
    all_matching AS (
      SELECT d.id
      FROM publicacoes_djen_descartadas d
      JOIN monitoramentos_djen m ON m.id = d.monitoramento_id
      WHERE (
        m.coordenacao_id::text || '|' ||
        regexp_replace(COALESCE(d.processo_numero, ''), '[^0-9]', '', 'g') || '|' ||
        COALESCE(
          to_char(d.data_publicacao::date, 'YYYY-MM-DD'),
          to_char(d.created_at::date, 'YYYY-MM-DD')
        ) || '|' ||
        left(lower(regexp_replace(regexp_replace(regexp_replace(
          COALESCE(public.strip_destinatarios(d.conteudo), ''), '<[^>]*>', ' ', 'g'
        ), '[^\w\s]', ' ', 'g'), '\s+', ' ', 'g')), 300)
      ) IN (SELECT dedup_key FROM dedup_keys)
        AND d.lida = false
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
