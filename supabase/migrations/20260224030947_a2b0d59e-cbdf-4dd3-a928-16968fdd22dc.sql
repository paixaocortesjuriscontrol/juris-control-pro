
-- Update marcar_publicacoes_lidas_por_dedup to use strip_destinatarios
CREATE OR REPLACE FUNCTION public.marcar_publicacoes_lidas_por_dedup(p_ids_termos uuid[] DEFAULT NULL::uuid[], p_ids_processos uuid[] DEFAULT NULL::uuid[], p_ids_descartadas uuid[] DEFAULT NULL::uuid[])
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_termos_atualizados int := 0;
  v_processos_atualizados int := 0;
  v_descartadas_atualizados int := 0;
BEGIN
  IF p_ids_termos IS NOT NULL AND array_length(p_ids_termos, 1) > 0 THEN
    WITH dedup_keys AS (
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
        ), '[^\w\s]', ' ', 'g'), '\s+', ' ', 'g')), 300) AS dedup_key
      FROM publicacoes_djen p
      JOIN monitoramentos_djen m ON m.id = p.monitoramento_id
      WHERE p.id = ANY(p_ids_termos)
    ),
    all_matching AS (
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
      ) IN (SELECT dedup_key FROM dedup_keys)
        AND p.lida = false
    )
    UPDATE publicacoes_djen SET lida = true
    WHERE id IN (SELECT id FROM all_matching);
    GET DIAGNOSTICS v_termos_atualizados = ROW_COUNT;
  END IF;

  IF p_ids_processos IS NOT NULL AND array_length(p_ids_processos, 1) > 0 THEN
    WITH dedup_keys AS (
      SELECT DISTINCT
        p.coordenacao_id::text || '|' ||
        regexp_replace(COALESCE(pp.processo_numero, ''), '[^0-9]', '', 'g') || '|' ||
        COALESCE(
          to_char(pp.data_publicacao::date, 'YYYY-MM-DD'),
          to_char(pp.data_disponibilizacao::date, 'YYYY-MM-DD'),
          to_char(pp.created_at::date, 'YYYY-MM-DD')
        ) || '|' ||
        left(lower(regexp_replace(regexp_replace(regexp_replace(
          COALESCE(public.strip_destinatarios(pp.conteudo), ''), '<[^>]*>', ' ', 'g'
        ), '[^\w\s]', ' ', 'g'), '\s+', ' ', 'g')), 300) AS dedup_key
      FROM publicacoes_djen_processos pp
      JOIN processos p ON p.id = pp.processo_id
      WHERE pp.id = ANY(p_ids_processos)
    ),
    all_matching AS (
      SELECT pp.id
      FROM publicacoes_djen_processos pp
      JOIN processos p ON p.id = pp.processo_id
      WHERE (
        p.coordenacao_id::text || '|' ||
        regexp_replace(COALESCE(pp.processo_numero, ''), '[^0-9]', '', 'g') || '|' ||
        COALESCE(
          to_char(pp.data_publicacao::date, 'YYYY-MM-DD'),
          to_char(pp.data_disponibilizacao::date, 'YYYY-MM-DD'),
          to_char(pp.created_at::date, 'YYYY-MM-DD')
        ) || '|' ||
        left(lower(regexp_replace(regexp_replace(regexp_replace(
          COALESCE(public.strip_destinatarios(pp.conteudo), ''), '<[^>]*>', ' ', 'g'
        ), '[^\w\s]', ' ', 'g'), '\s+', ' ', 'g')), 300)
      ) IN (SELECT dedup_key FROM dedup_keys)
        AND pp.lida = false
    )
    UPDATE publicacoes_djen_processos SET lida = true
    WHERE id IN (SELECT id FROM all_matching);
    GET DIAGNOSTICS v_processos_atualizados = ROW_COUNT;
  END IF;

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

-- Update count_djen_publicacoes_deduplicadas_hoje
CREATE OR REPLACE FUNCTION public.count_djen_publicacoes_deduplicadas_hoje()
 RETURNS TABLE(total_unicas bigint, total_bruto bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_inicio timestamptz;
  v_fim timestamptz;
BEGIN
  v_inicio := date_trunc('day', now() AT TIME ZONE 'America/Sao_Paulo') AT TIME ZONE 'America/Sao_Paulo';
  v_fim := v_inicio + interval '1 day';
  
  RETURN QUERY
  WITH pub_base AS (
    SELECT
      m.coordenacao_id,
      regexp_replace(COALESCE(p.processo_numero, ''), '[^0-9]', '', 'g') AS processo_digits,
      COALESCE(
        to_char(p.data_disponibilizacao::date, 'YYYY-MM-DD'),
        to_char(p.data_publicacao::date, 'YYYY-MM-DD'),
        to_char(p.created_at::date, 'YYYY-MM-DD')
      ) AS data_ref,
      left(
        lower(regexp_replace(regexp_replace(
          COALESCE(public.strip_destinatarios(p.conteudo), ''), '<[^>]*>', ' ', 'g'
        ), '\s+', ' ', 'g')),
        300
      ) AS head_norm
    FROM publicacoes_djen p
    JOIN monitoramentos_djen m ON m.id = p.monitoramento_id
    WHERE p.created_at >= v_inicio AND p.created_at < v_fim
  )
  SELECT
    COUNT(DISTINCT (
      COALESCE(pub_base.coordenacao_id::text, 'sem_coord') || '|' ||
      pub_base.processo_digits || '|' ||
      pub_base.data_ref || '|' ||
      pub_base.head_norm
    ))::bigint AS total_unicas,
    COUNT(*)::bigint AS total_bruto
  FROM pub_base;
END;
$function$;
