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
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  IF NOT (
    public.has_role(v_user_id, 'admin')
    OR EXISTS (
      SELECT 1
      FROM public.membros_coordenacao
      WHERE usuario_id = v_user_id
        AND coordenacao_id = p_coordenacao_id
    )
  ) THEN
    RAISE EXCEPTION 'Sem permissão para esta coordenação';
  END IF;

  SELECT COALESCE(nome, email, 'Usuário')
  INTO v_user_nome
  FROM public.profiles
  WHERE id = v_user_id;

  -- TERMOS: usar somente chaves pré-calculadas/curtas na comparação.
  -- A versão anterior ainda chamava normalização pesada de CONTEUDO no WHERE,
  -- causando Seq Scan e statement_timeout em coordenações maiores.
  CREATE TEMP TABLE IF NOT EXISTS _dup_termo (id uuid PRIMARY KEY) ON COMMIT DROP;
  TRUNCATE _dup_termo;

  INSERT INTO _dup_termo (id)
  WITH candidatos AS (
    SELECT
      pd.id,
      pd.created_at,
      COALESCE(pd.coordenacao_id, md.coordenacao_id) AS coord_id,
      COALESCE(
        NULLIF(pd.dedup_processo_digits, ''),
        NULLIF(regexp_replace(COALESCE(pd.processo_numero, ''), '\D', '', 'g'), '')
      ) AS processo_digits,
      COALESCE(
        pd.dedup_data_ref,
        (COALESCE(pd.data_publicacao, pd.data_disponibilizacao, pd.created_at) AT TIME ZONE 'America/Sao_Paulo')::date
      ) AS data_ref,
      COALESCE(
        NULLIF(pd.hash_conteudo, ''),
        NULLIF(pd.dedup_head_norm, ''),
        NULLIF(pd.dedup_key, ''),
        NULLIF(pd.dedup_conteudo_key, '')
      ) AS conteudo_key
    FROM public.publicacoes_djen pd
    JOIN public.monitoramentos_djen md ON md.id = pd.monitoramento_id
    WHERE pd.status IN ('encontrada','duplicada')
      AND (pd.coordenacao_id = p_coordenacao_id OR (pd.coordenacao_id IS NULL AND md.coordenacao_id = p_coordenacao_id))
      AND (
        p_data_disp_inicio IS NULL
        OR (COALESCE(pd.data_publicacao, pd.data_disponibilizacao, pd.created_at) AT TIME ZONE 'America/Sao_Paulo')::date >= p_data_disp_inicio
      )
      AND (
        p_data_disp_fim IS NULL
        OR (COALESCE(pd.data_publicacao, pd.data_disponibilizacao, pd.created_at) AT TIME ZONE 'America/Sao_Paulo')::date <= p_data_disp_fim
      )
  ), ranked AS (
    SELECT
      id,
      ROW_NUMBER() OVER (
        PARTITION BY coord_id, processo_digits, data_ref, conteudo_key
        ORDER BY created_at ASC, id ASC
      ) AS rn
    FROM candidatos
    WHERE processo_digits IS NOT NULL
      AND conteudo_key IS NOT NULL
  )
  SELECT id
  FROM ranked
  WHERE rn > 1;

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
    p.conteudo, p.fonte, 'duplicada_lote', p.data_disponibilizacao, p.tribunal,
    p.lida, p.orgao, p.tipo_comunicacao, p.meio, p.partes_json, p.advogados_json,
    p.dedup_processo_digits, p.dedup_data_ref, p.dedup_head_norm, p.coordenacao_id, p.id_djen,
    v_user_id, v_user_nome, v_lote_id,
    'termo', p.id, to_jsonb(p.*)
  FROM public.publicacoes_djen p
  JOIN _dup_termo d ON d.id = p.id;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_total := v_total + COALESCE(v_count, 0);

  DELETE FROM public.publicacoes_djen
  WHERE id IN (SELECT id FROM _dup_termo);

  -- PROCESSOS: mesma lógica, sem normalização pesada de CONTEUDO.
  CREATE TEMP TABLE IF NOT EXISTS _dup_proc (id uuid PRIMARY KEY) ON COMMIT DROP;
  TRUNCATE _dup_proc;

  INSERT INTO _dup_proc (id)
  WITH candidatos AS (
    SELECT
      pdp.id,
      pdp.created_at,
      pdp.coordenacao_id AS coord_id,
      COALESCE(
        NULLIF(pdp.dedup_processo_digits, ''),
        NULLIF(regexp_replace(COALESCE(pdp.processo_numero, ''), '\D', '', 'g'), '')
      ) AS processo_digits,
      COALESCE(
        pdp.dedup_data_ref,
        (COALESCE(pdp.data_publicacao, pdp.data_disponibilizacao, pdp.created_at) AT TIME ZONE 'America/Sao_Paulo')::date
      ) AS data_ref,
      COALESCE(
        NULLIF(pdp.hash_conteudo, ''),
        NULLIF(pdp.dedup_head_norm, ''),
        NULLIF(pdp.dedup_key, ''),
        NULLIF(pdp.dedup_conteudo_key, '')
      ) AS conteudo_key
    FROM public.publicacoes_djen_processos pdp
    WHERE pdp.coordenacao_id = p_coordenacao_id
      AND pdp.status IN ('encontrada','duplicada')
      AND (
        p_data_disp_inicio IS NULL
        OR (COALESCE(pdp.data_publicacao, pdp.data_disponibilizacao, pdp.created_at) AT TIME ZONE 'America/Sao_Paulo')::date >= p_data_disp_inicio
      )
      AND (
        p_data_disp_fim IS NULL
        OR (COALESCE(pdp.data_publicacao, pdp.data_disponibilizacao, pdp.created_at) AT TIME ZONE 'America/Sao_Paulo')::date <= p_data_disp_fim
      )
  ), ranked AS (
    SELECT
      id,
      ROW_NUMBER() OVER (
        PARTITION BY coord_id, processo_digits, data_ref, conteudo_key
        ORDER BY created_at ASC, id ASC
      ) AS rn
    FROM candidatos
    WHERE processo_digits IS NOT NULL
      AND conteudo_key IS NOT NULL
  )
  SELECT id
  FROM ranked
  WHERE rn > 1;

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
    p.conteudo, p.fonte, 'duplicada_lote', p.data_disponibilizacao, p.tribunal,
    p.lida, p.orgao, p.tipo_comunicacao, p.meio, p.partes_json, p.advogados_json,
    p.dedup_processo_digits, p.dedup_data_ref, p.dedup_head_norm, p.coordenacao_id, p.id_djen,
    v_user_id, v_user_nome, v_lote_id,
    'processo', p.id, to_jsonb(p.*)
  FROM public.publicacoes_djen_processos p
  JOIN _dup_proc d ON d.id = p.id;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_total := v_total + COALESCE(v_count, 0);

  DELETE FROM public.publicacoes_djen_processos
  WHERE id IN (SELECT id FROM _dup_proc);

  RETURN jsonb_build_object(
    'lote_id', v_lote_id,
    'total', v_total,
    'descartado_por_nome', v_user_nome,
    'data_inicio', p_data_disp_inicio,
    'data_fim', p_data_disp_fim,
    'coordenacao_id', p_coordenacao_id
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.descartar_duplicadas_coordenacao(uuid, date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.descartar_duplicadas_coordenacao(uuid, date, date) TO service_role;