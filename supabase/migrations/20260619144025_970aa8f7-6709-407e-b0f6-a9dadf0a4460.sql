CREATE OR REPLACE FUNCTION public.descartar_duplicadas_coordenacao(
  p_coordenacao_id uuid,
  p_data_disp_inicio date DEFAULT NULL,
  p_data_disp_fim date DEFAULT NULL
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
      SELECT 1 FROM public.membros_coordenacao
      WHERE usuario_id = v_user_id AND coordenacao_id = p_coordenacao_id
    )
  ) THEN
    RAISE EXCEPTION 'Sem permissão para esta coordenação';
  END IF;

  SELECT COALESCE(nome, email, 'Usuário') INTO v_user_nome
  FROM public.profiles WHERE id = v_user_id;

  CREATE TEMP TABLE IF NOT EXISTS _dup_termo (id uuid PRIMARY KEY) ON COMMIT DROP;
  TRUNCATE _dup_termo;
  -- Filtro de intervalo agora considera data_publicacao OU data_disponibilizacao
  -- (a UI "Somente Hoje" filtra a lista por data_publicacao, então o descarte
  -- precisa pegar tudo que está visível, independentemente de qual dos dois campos
  -- bate com o intervalo informado).
  INSERT INTO _dup_termo (id)
  SELECT id FROM (
    SELECT pd.id,
      ROW_NUMBER() OVER (
        PARTITION BY public.compute_djen_conteudo_dedup_key(
          COALESCE(md.coordenacao_id, pd.coordenacao_id),
          pd.processo_numero,
          pd.data_disponibilizacao,
          pd.data_publicacao,
          pd.created_at,
          pd.conteudo
        )
        ORDER BY
          CASE WHEN pd.status = 'encontrada' THEN 0 ELSE 1 END,
          CASE WHEN md.tipo = 'parte' THEN 0 ELSE 1 END,
          length(COALESCE(pd.conteudo,'')) DESC,
          pd.created_at DESC,
          pd.id DESC
      ) AS rn
    FROM public.publicacoes_djen pd
    JOIN public.monitoramentos_djen md ON md.id = pd.monitoramento_id
    WHERE COALESCE(md.coordenacao_id, pd.coordenacao_id) = p_coordenacao_id
      AND pd.status IN ('encontrada','duplicada')
      AND (
        p_data_disp_inicio IS NULL
        OR pd.data_disponibilizacao::date >= p_data_disp_inicio
        OR pd.data_publicacao::date       >= p_data_disp_inicio
      )
      AND (
        p_data_disp_fim IS NULL
        OR pd.data_disponibilizacao::date <= p_data_disp_fim
        OR pd.data_publicacao::date       <= p_data_disp_fim
      )
      AND public.compute_djen_conteudo_dedup_key(
            COALESCE(md.coordenacao_id, pd.coordenacao_id),
            pd.processo_numero, pd.data_disponibilizacao,
            pd.data_publicacao, pd.created_at, pd.conteudo
          ) IS NOT NULL
  ) r WHERE rn > 1;

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

  DELETE FROM public.publicacoes_djen WHERE id IN (SELECT id FROM _dup_termo);

  CREATE TEMP TABLE IF NOT EXISTS _dup_proc (id uuid PRIMARY KEY) ON COMMIT DROP;
  TRUNCATE _dup_proc;
  INSERT INTO _dup_proc (id)
  SELECT id FROM (
    SELECT pdp.id,
      ROW_NUMBER() OVER (
        PARTITION BY public.compute_djen_conteudo_dedup_key(
          pdp.coordenacao_id,
          pdp.processo_numero,
          pdp.data_disponibilizacao,
          pdp.data_publicacao,
          pdp.created_at,
          pdp.conteudo
        )
        ORDER BY
          CASE WHEN pdp.status = 'encontrada' THEN 0 ELSE 1 END,
          length(COALESCE(pdp.conteudo,'')) DESC,
          pdp.created_at DESC,
          pdp.id DESC
      ) AS rn
    FROM public.publicacoes_djen_processos pdp
    WHERE pdp.coordenacao_id = p_coordenacao_id
      AND pdp.status IN ('encontrada','duplicada')
      AND (
        p_data_disp_inicio IS NULL
        OR pdp.data_disponibilizacao::date >= p_data_disp_inicio
        OR pdp.data_publicacao::date       >= p_data_disp_inicio
      )
      AND (
        p_data_disp_fim IS NULL
        OR pdp.data_disponibilizacao::date <= p_data_disp_fim
        OR pdp.data_publicacao::date       <= p_data_disp_fim
      )
      AND public.compute_djen_conteudo_dedup_key(
            pdp.coordenacao_id, pdp.processo_numero, pdp.data_disponibilizacao,
            pdp.data_publicacao, pdp.created_at, pdp.conteudo
          ) IS NOT NULL
  ) r WHERE rn > 1;

  INSERT INTO public.publicacoes_djen_descartadas (
    monitoramento_id, hash_conteudo, data_publicacao, processo_numero,
    conteudo, fonte, motivo_descarte, data_disponibilizacao, tribunal,
    lida, orgao, tipo_comunicacao, meio, partes_json, advogados_json,
    dedup_processo_digits, dedup_data_ref, dedup_head_norm, coordenacao_id, id_djen,
    descartado_por, descartado_por_nome, lote_descarte_id,
    tipo_origem_origem, id_origem, payload_origem
  )
  SELECT
    NULL, p.hash_conteudo, p.data_publicacao, p.processo_numero,
    p.conteudo, p.fonte, 'duplicada_lote', p.data_disponibilizacao, p.tribunal,
    p.lida, p.orgao, p.tipo_comunicacao, p.meio, p.partes_json, p.advogados_json,
    p.dedup_processo_digits, p.dedup_data_ref, p.dedup_head_norm, p.coordenacao_id, p.id_djen,
    v_user_id, v_user_nome, v_lote_id,
    'processo', p.id, to_jsonb(p.*)
  FROM public.publicacoes_djen_processos p
  JOIN _dup_proc d ON d.id = p.id;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_total := v_total + COALESCE(v_count, 0);

  DELETE FROM public.publicacoes_djen_processos WHERE id IN (SELECT id FROM _dup_proc);

  RETURN jsonb_build_object(
    'lote_id', v_lote_id,
    'total', v_total,
    'descartado_por_nome', v_user_nome,
    'data_inicio', p_data_disp_inicio,
    'data_fim', p_data_disp_fim
  );
END;
$function$;