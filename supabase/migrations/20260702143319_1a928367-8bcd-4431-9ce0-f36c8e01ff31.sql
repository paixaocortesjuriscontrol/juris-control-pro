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

  -- Sem data preenchida na tela: descarta somente o dia atual em BRT.
  -- Se apenas uma ponta vier preenchida, trata como aquele único dia.
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

  SELECT COALESCE(pr.nome, pr.email, 'Usuário')
    INTO v_user_nome
  FROM public.profiles pr
  WHERE pr.id = v_user_id;

  CREATE TEMP TABLE IF NOT EXISTS _dup_ids (id uuid PRIMARY KEY) ON COMMIT DROP;
  TRUNCATE _dup_ids;

  INSERT INTO _dup_ids (id)
  WITH candidatos AS (
    SELECT
      pd.id,
      pd.created_at,
      COALESCE(pd.coordenacao_id, md.coordenacao_id) AS coord_id,
      NULLIF(regexp_replace(COALESCE(pd.processo_numero, pd.dedup_processo_digits, ''), '[^0-9]', '', 'g'), '') AS processo_digits,
      NULLIF(public.djen_normalize_conteudo_descarte_sem_intimados(pd.conteudo), '') AS conteudo_norm,
      NULLIF(TRIM(pd.id_djen::text), '') AS id_djen_norm,
      length(COALESCE(pd.conteudo, '')) AS conteudo_len
    FROM public.publicacoes_djen pd
    LEFT JOIN public.monitoramentos_djen md ON md.id = pd.monitoramento_id
    WHERE pd.status IN ('encontrada', 'duplicada')
      AND COALESCE(pd.coordenacao_id, md.coordenacao_id) = p_coordenacao_id
      AND (COALESCE(pd.data_publicacao, pd.data_disponibilizacao, pd.created_at) AT TIME ZONE 'America/Sao_Paulo')::date >= v_data_inicio
      AND (COALESCE(pd.data_publicacao, pd.data_disponibilizacao, pd.created_at) AT TIME ZONE 'America/Sao_Paulo')::date <= v_data_fim
  ), grupos AS (
    SELECT
      c.coord_id,
      c.processo_digits,
      c.conteudo_norm
    FROM candidatos c
    WHERE c.coord_id = p_coordenacao_id
      AND c.processo_digits IS NOT NULL
      AND c.conteudo_norm IS NOT NULL
      AND c.id_djen_norm IS NOT NULL
    GROUP BY c.coord_id, c.processo_digits, c.conteudo_norm
    HAVING COUNT(*) > 1
       AND COUNT(DISTINCT c.id_djen_norm) > 1
  ), ranked AS (
    SELECT
      c.id,
      ROW_NUMBER() OVER (
        PARTITION BY c.coord_id, c.processo_digits, c.conteudo_norm
        ORDER BY c.conteudo_len DESC, c.created_at ASC, c.id ASC
      ) AS rn
    FROM candidatos c
    JOIN grupos g
      ON g.coord_id = c.coord_id
     AND g.processo_digits = c.processo_digits
     AND g.conteudo_norm = c.conteudo_norm
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
    p.conteudo, p.fonte, 'duplicada_mesmo_processo_conteudo_sem_intimados_id_djen_diferente', p.data_disponibilizacao, p.tribunal,
    p.lida, p.orgao, p.tipo_comunicacao, p.meio, p.partes_json, p.advogados_json,
    p.dedup_processo_digits, p.dedup_data_ref, p.dedup_head_norm, p.coordenacao_id, p.id_djen,
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
    'total_descartadas', v_total,
    'lote_id', v_lote_id,
    'data_inicio', v_data_inicio,
    'data_fim', v_data_fim,
    'regra', 'mesma_coordenação + mesmo_processo + mesmo_conteúdo_sem_intimados + id_djen_diferente'
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.descartar_duplicadas_coordenacao(p_coordenacao_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN public.descartar_duplicadas_coordenacao(p_coordenacao_id, NULL::date, NULL::date);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.descartar_duplicadas_coordenacao(uuid, date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.descartar_duplicadas_coordenacao(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.descartar_duplicadas_coordenacao(uuid, date, date) TO service_role;
GRANT EXECUTE ON FUNCTION public.descartar_duplicadas_coordenacao(uuid) TO service_role;