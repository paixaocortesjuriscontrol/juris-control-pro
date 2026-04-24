CREATE INDEX IF NOT EXISTS idx_monitoramentos_djen_coordenacao_id_id
  ON public.monitoramentos_djen (coordenacao_id, id);

CREATE INDEX IF NOT EXISTS idx_processos_coordenacao_id_id
  ON public.processos (coordenacao_id, id);

CREATE INDEX IF NOT EXISTS idx_pub_djen_unread_group_lookup
  ON public.publicacoes_djen (monitoramento_id, dedup_data_ref, dedup_processo_digits, dedup_head_norm)
  WHERE lida = false;

CREATE INDEX IF NOT EXISTS idx_pub_djen_processos_unread_group_lookup
  ON public.publicacoes_djen_processos (processo_id, dedup_data_ref, dedup_processo_digits, dedup_head_norm)
  WHERE lida = false;

CREATE INDEX IF NOT EXISTS idx_pub_djen_descartadas_unread_group_lookup
  ON public.publicacoes_djen_descartadas (monitoramento_id, dedup_data_ref, dedup_processo_digits, dedup_head_norm)
  WHERE lida = false;

CREATE OR REPLACE FUNCTION public.get_publicacoes_relacionadas_por_dedup(
  p_ids_termos uuid[] DEFAULT NULL,
  p_ids_processos uuid[] DEFAULT NULL,
  p_ids_descartadas uuid[] DEFAULT NULL
)
RETURNS TABLE(publicacao_id uuid, tabela_origem text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH seed_keys AS (
    SELECT DISTINCT pd.dedup_processo_digits, pd.dedup_data_ref, pd.dedup_head_norm, md.coordenacao_id
    FROM public.publicacoes_djen pd
    JOIN public.monitoramentos_djen md ON md.id = pd.monitoramento_id
    WHERE COALESCE(array_length(p_ids_termos, 1), 0) > 0
      AND pd.id = ANY(p_ids_termos)

    UNION

    SELECT DISTINCT pdp.dedup_processo_digits, pdp.dedup_data_ref, pdp.dedup_head_norm, p.coordenacao_id
    FROM public.publicacoes_djen_processos pdp
    JOIN public.processos p ON p.id = pdp.processo_id
    WHERE COALESCE(array_length(p_ids_processos, 1), 0) > 0
      AND pdp.id = ANY(p_ids_processos)

    UNION

    SELECT DISTINCT pdd.dedup_processo_digits, pdd.dedup_data_ref, pdd.dedup_head_norm, md.coordenacao_id
    FROM public.publicacoes_djen_descartadas pdd
    JOIN public.monitoramentos_djen md ON md.id = pdd.monitoramento_id
    WHERE COALESCE(array_length(p_ids_descartadas, 1), 0) > 0
      AND pdd.id = ANY(p_ids_descartadas)
  )
  SELECT DISTINCT t.id AS publicacao_id, 'termo'::text AS tabela_origem
  FROM public.publicacoes_djen t
  JOIN public.monitoramentos_djen md ON md.id = t.monitoramento_id
  JOIN seed_keys sk
    ON sk.coordenacao_id = md.coordenacao_id
   AND t.dedup_processo_digits IS NOT DISTINCT FROM sk.dedup_processo_digits
   AND t.dedup_data_ref IS NOT DISTINCT FROM sk.dedup_data_ref
   AND t.dedup_head_norm IS NOT DISTINCT FROM sk.dedup_head_norm

  UNION

  SELECT DISTINCT t.id AS publicacao_id, 'processo'::text AS tabela_origem
  FROM public.publicacoes_djen_processos t
  JOIN public.processos p ON p.id = t.processo_id
  JOIN seed_keys sk
    ON sk.coordenacao_id = p.coordenacao_id
   AND t.dedup_processo_digits IS NOT DISTINCT FROM sk.dedup_processo_digits
   AND t.dedup_data_ref IS NOT DISTINCT FROM sk.dedup_data_ref
   AND t.dedup_head_norm IS NOT DISTINCT FROM sk.dedup_head_norm

  UNION

  SELECT DISTINCT t.id AS publicacao_id, 'descartada'::text AS tabela_origem
  FROM public.publicacoes_djen_descartadas t
  JOIN public.monitoramentos_djen md ON md.id = t.monitoramento_id
  JOIN seed_keys sk
    ON sk.coordenacao_id = md.coordenacao_id
   AND t.dedup_processo_digits IS NOT DISTINCT FROM sk.dedup_processo_digits
   AND t.dedup_data_ref IS NOT DISTINCT FROM sk.dedup_data_ref
   AND t.dedup_head_norm IS NOT DISTINCT FROM sk.dedup_head_norm;
$$;

DROP FUNCTION IF EXISTS public.marcar_publicacoes_lidas_por_dedup(uuid[], uuid[], uuid[]);

CREATE OR REPLACE FUNCTION public.marcar_publicacoes_lidas_por_dedup(
  p_ids_termos uuid[] DEFAULT NULL,
  p_ids_processos uuid[] DEFAULT NULL,
  p_ids_descartadas uuid[] DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_termos_atualizados int := 0;
  v_processos_atualizados int := 0;
  v_descartadas_atualizados int := 0;
BEGIN
  IF COALESCE(array_length(p_ids_termos, 1), 0) > 0 THEN
    WITH seed_keys AS (
      SELECT DISTINCT pd.dedup_processo_digits, pd.dedup_data_ref, pd.dedup_head_norm, md.coordenacao_id
      FROM public.publicacoes_djen pd
      JOIN public.monitoramentos_djen md ON md.id = pd.monitoramento_id
      WHERE pd.id = ANY(p_ids_termos)
    )
    UPDATE public.publicacoes_djen t
       SET lida = true
      FROM public.monitoramentos_djen md
     WHERE t.monitoramento_id = md.id
       AND COALESCE(t.lida, false) = false
       AND EXISTS (
         SELECT 1
           FROM seed_keys sk
          WHERE sk.coordenacao_id = md.coordenacao_id
            AND t.dedup_processo_digits IS NOT DISTINCT FROM sk.dedup_processo_digits
            AND t.dedup_data_ref IS NOT DISTINCT FROM sk.dedup_data_ref
            AND t.dedup_head_norm IS NOT DISTINCT FROM sk.dedup_head_norm
       );
    GET DIAGNOSTICS v_termos_atualizados = ROW_COUNT;

    WITH seed_keys AS (
      SELECT DISTINCT pd.dedup_processo_digits, pd.dedup_data_ref, pd.dedup_head_norm, md.coordenacao_id
      FROM public.publicacoes_djen pd
      JOIN public.monitoramentos_djen md ON md.id = pd.monitoramento_id
      WHERE pd.id = ANY(p_ids_termos)
    )
    UPDATE public.publicacoes_djen_processos t
       SET lida = true
      FROM public.processos p
     WHERE t.processo_id = p.id
       AND COALESCE(t.lida, false) = false
       AND EXISTS (
         SELECT 1
           FROM seed_keys sk
          WHERE sk.coordenacao_id = p.coordenacao_id
            AND t.dedup_processo_digits IS NOT DISTINCT FROM sk.dedup_processo_digits
            AND t.dedup_data_ref IS NOT DISTINCT FROM sk.dedup_data_ref
            AND t.dedup_head_norm IS NOT DISTINCT FROM sk.dedup_head_norm
       );

    WITH seed_keys AS (
      SELECT DISTINCT pd.dedup_processo_digits, pd.dedup_data_ref, pd.dedup_head_norm, md.coordenacao_id
      FROM public.publicacoes_djen pd
      JOIN public.monitoramentos_djen md ON md.id = pd.monitoramento_id
      WHERE pd.id = ANY(p_ids_termos)
    )
    UPDATE public.publicacoes_djen_descartadas t
       SET lida = true
      FROM public.monitoramentos_djen md
     WHERE t.monitoramento_id = md.id
       AND COALESCE(t.lida, false) = false
       AND EXISTS (
         SELECT 1
           FROM seed_keys sk
          WHERE sk.coordenacao_id = md.coordenacao_id
            AND t.dedup_processo_digits IS NOT DISTINCT FROM sk.dedup_processo_digits
            AND t.dedup_data_ref IS NOT DISTINCT FROM sk.dedup_data_ref
            AND t.dedup_head_norm IS NOT DISTINCT FROM sk.dedup_head_norm
       );
  END IF;

  IF COALESCE(array_length(p_ids_processos, 1), 0) > 0 THEN
    WITH seed_keys AS (
      SELECT DISTINCT pdp.dedup_processo_digits, pdp.dedup_data_ref, pdp.dedup_head_norm, p.coordenacao_id
      FROM public.publicacoes_djen_processos pdp
      JOIN public.processos p ON p.id = pdp.processo_id
      WHERE pdp.id = ANY(p_ids_processos)
    )
    UPDATE public.publicacoes_djen_processos t
       SET lida = true
      FROM public.processos p
     WHERE t.processo_id = p.id
       AND COALESCE(t.lida, false) = false
       AND EXISTS (
         SELECT 1
           FROM seed_keys sk
          WHERE sk.coordenacao_id = p.coordenacao_id
            AND t.dedup_processo_digits IS NOT DISTINCT FROM sk.dedup_processo_digits
            AND t.dedup_data_ref IS NOT DISTINCT FROM sk.dedup_data_ref
            AND t.dedup_head_norm IS NOT DISTINCT FROM sk.dedup_head_norm
       );
    GET DIAGNOSTICS v_processos_atualizados = ROW_COUNT;

    WITH seed_keys AS (
      SELECT DISTINCT pdp.dedup_processo_digits, pdp.dedup_data_ref, pdp.dedup_head_norm, p.coordenacao_id
      FROM public.publicacoes_djen_processos pdp
      JOIN public.processos p ON p.id = pdp.processo_id
      WHERE pdp.id = ANY(p_ids_processos)
    )
    UPDATE public.publicacoes_djen t
       SET lida = true
      FROM public.monitoramentos_djen md
     WHERE t.monitoramento_id = md.id
       AND COALESCE(t.lida, false) = false
       AND EXISTS (
         SELECT 1
           FROM seed_keys sk
          WHERE sk.coordenacao_id = md.coordenacao_id
            AND t.dedup_processo_digits IS NOT DISTINCT FROM sk.dedup_processo_digits
            AND t.dedup_data_ref IS NOT DISTINCT FROM sk.dedup_data_ref
            AND t.dedup_head_norm IS NOT DISTINCT FROM sk.dedup_head_norm
       );
  END IF;

  IF COALESCE(array_length(p_ids_descartadas, 1), 0) > 0 THEN
    WITH seed_keys AS (
      SELECT DISTINCT pdd.dedup_processo_digits, pdd.dedup_data_ref, pdd.dedup_head_norm, md.coordenacao_id
      FROM public.publicacoes_djen_descartadas pdd
      JOIN public.monitoramentos_djen md ON md.id = pdd.monitoramento_id
      WHERE pdd.id = ANY(p_ids_descartadas)
    )
    UPDATE public.publicacoes_djen_descartadas t
       SET lida = true
      FROM public.monitoramentos_djen md
     WHERE t.monitoramento_id = md.id
       AND COALESCE(t.lida, false) = false
       AND EXISTS (
         SELECT 1
           FROM seed_keys sk
          WHERE sk.coordenacao_id = md.coordenacao_id
            AND t.dedup_processo_digits IS NOT DISTINCT FROM sk.dedup_processo_digits
            AND t.dedup_data_ref IS NOT DISTINCT FROM sk.dedup_data_ref
            AND t.dedup_head_norm IS NOT DISTINCT FROM sk.dedup_head_norm
       );
    GET DIAGNOSTICS v_descartadas_atualizados = ROW_COUNT;
  END IF;

  RETURN jsonb_build_object(
    'termos_atualizados', v_termos_atualizados,
    'processos_atualizados', v_processos_atualizados,
    'descartadas_atualizados', v_descartadas_atualizados
  );
END;
$function$;