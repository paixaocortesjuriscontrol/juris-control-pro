
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
      SELECT 1 FROM public.membros_coordenacao
      WHERE usuario_id = v_user_id AND coordenacao_id = p_coordenacao_id
    )
  ) THEN
    RAISE EXCEPTION 'Sem permissão para esta coordenação';
  END IF;

  SELECT COALESCE(nome, email, 'Usuário') INTO v_user_nome
  FROM public.profiles WHERE id = v_user_id;

  -- TERMOS: particiona por hash MD5 do conteúdo normalizado (rápido)
  CREATE TEMP TABLE IF NOT EXISTS _dup_termo (id uuid PRIMARY KEY) ON COMMIT DROP;
  TRUNCATE _dup_termo;

  INSERT INTO _dup_termo (id)
  SELECT id FROM (
    SELECT pd.id,
      ROW_NUMBER() OVER (
        PARTITION BY
          COALESCE(pd.coordenacao_id, md.coordenacao_id),
          regexp_replace(COALESCE(pd.processo_numero, ''), '\D', '', 'g'),
          md5(public.djen_normalize_conteudo_descarte_sem_intimados(pd.conteudo))
        ORDER BY pd.created_at ASC, pd.id ASC
      ) AS rn
    FROM public.publicacoes_djen pd
    JOIN public.monitoramentos_djen md ON md.id = pd.monitoramento_id
    WHERE COALESCE(pd.coordenacao_id, md.coordenacao_id) = p_coordenacao_id
      AND pd.status IN ('encontrada','duplicada')
      AND regexp_replace(COALESCE(pd.processo_numero, ''), '\D', '', 'g') <> ''
      AND public.djen_normalize_conteudo_descarte_sem_intimados(pd.conteudo) <> ''
      AND (
        p_data_disp_inicio IS NULL
        OR (COALESCE(pd.data_publicacao, pd.data_disponibilizacao, pd.created_at) AT TIME ZONE 'America/Sao_Paulo')::date >= p_data_disp_inicio
      )
      AND (
        p_data_disp_fim IS NULL
        OR (COALESCE(pd.data_publicacao, pd.data_disponibilizacao, pd.created_at) AT TIME ZONE 'America/Sao_Paulo')::date <= p_data_disp_fim
      )
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

  -- PROCESSOS: mesma lógica com hash MD5
  CREATE TEMP TABLE IF NOT EXISTS _dup_proc (id uuid PRIMARY KEY) ON COMMIT DROP;
  TRUNCATE _dup_proc;

  INSERT INTO _dup_proc (id)
  SELECT id FROM (
    SELECT pdp.id,
      ROW_NUMBER() OVER (
        PARTITION BY
          pdp.coordenacao_id,
          regexp_replace(COALESCE(pdp.processo_numero, ''), '\D', '', 'g'),
          md5(public.djen_normalize_conteudo_descarte_sem_intimados(pdp.conteudo))
        ORDER BY pdp.created_at ASC, pdp.id ASC
      ) AS rn
    FROM public.publicacoes_djen_processos pdp
    WHERE pdp.coordenacao_id = p_coordenacao_id
      AND pdp.status IN ('encontrada','duplicada')
      AND regexp_replace(COALESCE(pdp.processo_numero, ''), '\D', '', 'g') <> ''
      AND public.djen_normalize_conteudo_descarte_sem_intimados(pdp.conteudo) <> ''
      AND (
        p_data_disp_inicio IS NULL
        OR (COALESCE(pdp.data_publicacao, pdp.data_disponibilizacao, pdp.created_at) AT TIME ZONE 'America/Sao_Paulo')::date >= p_data_disp_inicio
      )
      AND (
        p_data_disp_fim IS NULL
        OR (COALESCE(pdp.data_publicacao, pdp.data_disponibilizacao, pdp.created_at) AT TIME ZONE 'America/Sao_Paulo')::date <= p_data_disp_fim
      )
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
    'data_fim', p_data_disp_fim,
    'coordenacao_id', p_coordenacao_id
  );
END;
$function$;
