
DROP FUNCTION IF EXISTS public.marcar_publicacoes_lidas_por_dedup(uuid[], uuid[], uuid[]);

CREATE OR REPLACE FUNCTION public.marcar_publicacoes_lidas_por_dedup(
  p_ids_termos uuid[] DEFAULT NULL, p_ids_processos uuid[] DEFAULT NULL, p_ids_descartadas uuid[] DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_termos_atualizados int := 0; v_processos_atualizados int := 0; v_descartadas_atualizados int := 0;
  v_min_date timestamptz; v_max_date timestamptz;
BEGIN
  SELECT LEAST(
    (SELECT MIN(created_at) FROM publicacoes_djen WHERE id = ANY(COALESCE(p_ids_termos, ARRAY[]::uuid[]))),
    (SELECT MIN(created_at) FROM publicacoes_djen_processos WHERE id = ANY(COALESCE(p_ids_processos, ARRAY[]::uuid[]))),
    (SELECT MIN(created_at) FROM publicacoes_djen_descartadas WHERE id = ANY(COALESCE(p_ids_descartadas, ARRAY[]::uuid[])))
  ) - interval '2 days',
  GREATEST(
    (SELECT MAX(created_at) FROM publicacoes_djen WHERE id = ANY(COALESCE(p_ids_termos, ARRAY[]::uuid[]))),
    (SELECT MAX(created_at) FROM publicacoes_djen_processos WHERE id = ANY(COALESCE(p_ids_processos, ARRAY[]::uuid[]))),
    (SELECT MAX(created_at) FROM publicacoes_djen_descartadas WHERE id = ANY(COALESCE(p_ids_descartadas, ARRAY[]::uuid[])))
  ) + interval '2 days'
  INTO v_min_date, v_max_date;

  IF v_min_date IS NULL OR v_max_date IS NULL THEN
    RETURN jsonb_build_object('termos_atualizados', 0, 'processos_atualizados', 0, 'descartadas_atualizados', 0);
  END IF;

  IF p_ids_termos IS NOT NULL AND array_length(p_ids_termos, 1) > 0 THEN
    WITH source_keys AS (
      SELECT DISTINCT pd.dedup_processo_digits, pd.dedup_data_ref, pd.dedup_head_norm, md.coordenacao_id
      FROM publicacoes_djen pd JOIN monitoramentos_djen md ON md.id = pd.monitoramento_id
      WHERE pd.id = ANY(p_ids_termos)
    )
    UPDATE publicacoes_djen t SET lida = true
    FROM source_keys sk JOIN monitoramentos_djen md2 ON md2.coordenacao_id = sk.coordenacao_id
    WHERE t.monitoramento_id = md2.id AND t.lida = false
      AND t.created_at >= v_min_date AND t.created_at <= v_max_date
      AND t.dedup_processo_digits IS NOT DISTINCT FROM sk.dedup_processo_digits
      AND t.dedup_data_ref IS NOT DISTINCT FROM sk.dedup_data_ref
      AND t.dedup_head_norm IS NOT DISTINCT FROM sk.dedup_head_norm;
    GET DIAGNOSTICS v_termos_atualizados = ROW_COUNT;

    WITH source_keys AS (
      SELECT DISTINCT pd.dedup_processo_digits, pd.dedup_data_ref, pd.dedup_head_norm, md.coordenacao_id
      FROM publicacoes_djen pd JOIN monitoramentos_djen md ON md.id = pd.monitoramento_id
      WHERE pd.id = ANY(p_ids_termos)
    )
    UPDATE publicacoes_djen_processos t SET lida = true
    FROM source_keys sk JOIN processos p ON p.coordenacao_id = sk.coordenacao_id
    WHERE t.processo_id = p.id AND t.lida = false
      AND t.created_at >= v_min_date AND t.created_at <= v_max_date
      AND t.dedup_processo_digits IS NOT DISTINCT FROM sk.dedup_processo_digits
      AND t.dedup_data_ref IS NOT DISTINCT FROM sk.dedup_data_ref
      AND t.dedup_head_norm IS NOT DISTINCT FROM sk.dedup_head_norm;

    WITH source_keys AS (
      SELECT DISTINCT pd.dedup_processo_digits, pd.dedup_data_ref, pd.dedup_head_norm, md.coordenacao_id
      FROM publicacoes_djen pd JOIN monitoramentos_djen md ON md.id = pd.monitoramento_id
      WHERE pd.id = ANY(p_ids_termos)
    )
    UPDATE publicacoes_djen_descartadas t SET lida = true
    FROM source_keys sk JOIN monitoramentos_djen md3 ON md3.coordenacao_id = sk.coordenacao_id
    WHERE t.monitoramento_id = md3.id AND t.lida = false
      AND t.created_at >= v_min_date AND t.created_at <= v_max_date
      AND t.dedup_processo_digits IS NOT DISTINCT FROM sk.dedup_processo_digits
      AND t.dedup_data_ref IS NOT DISTINCT FROM sk.dedup_data_ref
      AND t.dedup_head_norm IS NOT DISTINCT FROM sk.dedup_head_norm;
  END IF;

  IF p_ids_processos IS NOT NULL AND array_length(p_ids_processos, 1) > 0 THEN
    WITH source_keys AS (
      SELECT DISTINCT pdp.dedup_processo_digits, pdp.dedup_data_ref, pdp.dedup_head_norm, p.coordenacao_id
      FROM publicacoes_djen_processos pdp JOIN processos p ON p.id = pdp.processo_id
      WHERE pdp.id = ANY(p_ids_processos)
    )
    UPDATE publicacoes_djen_processos t SET lida = true
    FROM source_keys sk JOIN processos p2 ON p2.coordenacao_id = sk.coordenacao_id
    WHERE t.processo_id = p2.id AND t.lida = false
      AND t.created_at >= v_min_date AND t.created_at <= v_max_date
      AND t.dedup_processo_digits IS NOT DISTINCT FROM sk.dedup_processo_digits
      AND t.dedup_data_ref IS NOT DISTINCT FROM sk.dedup_data_ref
      AND t.dedup_head_norm IS NOT DISTINCT FROM sk.dedup_head_norm;
    GET DIAGNOSTICS v_processos_atualizados = ROW_COUNT;

    WITH source_keys AS (
      SELECT DISTINCT pdp.dedup_processo_digits, pdp.dedup_data_ref, pdp.dedup_head_norm, p.coordenacao_id
      FROM publicacoes_djen_processos pdp JOIN processos p ON p.id = pdp.processo_id
      WHERE pdp.id = ANY(p_ids_processos)
    )
    UPDATE publicacoes_djen t SET lida = true
    FROM source_keys sk JOIN monitoramentos_djen md ON md.coordenacao_id = sk.coordenacao_id
    WHERE t.monitoramento_id = md.id AND t.lida = false
      AND t.created_at >= v_min_date AND t.created_at <= v_max_date
      AND t.dedup_processo_digits IS NOT DISTINCT FROM sk.dedup_processo_digits
      AND t.dedup_data_ref IS NOT DISTINCT FROM sk.dedup_data_ref
      AND t.dedup_head_norm IS NOT DISTINCT FROM sk.dedup_head_norm;
  END IF;

  IF p_ids_descartadas IS NOT NULL AND array_length(p_ids_descartadas, 1) > 0 THEN
    UPDATE publicacoes_djen_descartadas SET lida = true WHERE id = ANY(p_ids_descartadas) AND lida = false;
    GET DIAGNOSTICS v_descartadas_atualizados = ROW_COUNT;
  END IF;

  RETURN jsonb_build_object('termos_atualizados', v_termos_atualizados, 'processos_atualizados', v_processos_atualizados, 'descartadas_atualizados', v_descartadas_atualizados);
END;
$function$;

-- count + get RPCs already updated in previous attempt (count_djen_publicacoes_unificadas, get_djen_publicacoes_unificadas succeeded)
-- Update count_djen_publicacoes_deduplicadas_hoje
CREATE OR REPLACE FUNCTION public.count_djen_publicacoes_deduplicadas_hoje()
RETURNS TABLE(total_unicas bigint, total_bruto bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_inicio timestamptz; v_fim timestamptz;
BEGIN
  v_inicio := date_trunc('day', now() AT TIME ZONE 'America/Sao_Paulo') AT TIME ZONE 'America/Sao_Paulo';
  v_fim := v_inicio + interval '1 day';
  RETURN QUERY
  SELECT COUNT(DISTINCT (COALESCE(m.coordenacao_id::text, 'sem_coord') || '|' || COALESCE(p.dedup_processo_digits, '') || '|' || COALESCE(p.dedup_data_ref::text, '') || '|' || COALESCE(p.dedup_head_norm, '')))::bigint AS total_unicas,
    COUNT(*)::bigint AS total_bruto
  FROM publicacoes_djen p JOIN monitoramentos_djen m ON m.id = p.monitoramento_id
  WHERE p.created_at >= v_inicio AND p.created_at < v_fim;
END;
$function$;
