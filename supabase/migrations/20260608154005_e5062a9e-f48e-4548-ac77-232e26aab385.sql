
-- Make descartar_duplicadas_coordenacao resilient to unique-conflicts on
-- (monitoramento_id, hash_conteudo) so the dup is always removed from the
-- origin table even when a previous lote already recorded the same hash.
CREATE OR REPLACE FUNCTION public.descartar_duplicadas_coordenacao(
  p_coordenacao_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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

  -- ============ publicacoes_djen (termo) ============
  CREATE TEMP TABLE IF NOT EXISTS _dup_termo (id uuid PRIMARY KEY) ON COMMIT DROP;
  TRUNCATE _dup_termo;
  INSERT INTO _dup_termo (id)
  SELECT id FROM (
    SELECT id,
      ROW_NUMBER() OVER (
        PARTITION BY dedup_processo_digits, dedup_data_ref, dedup_head_norm
        ORDER BY created_at ASC, id ASC
      ) AS rn
    FROM public.publicacoes_djen
    WHERE coordenacao_id = p_coordenacao_id
      AND dedup_processo_digits IS NOT NULL
      AND dedup_data_ref IS NOT NULL
      AND dedup_head_norm IS NOT NULL
  ) r WHERE rn > 1;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_total := v_total + COALESCE(v_count, 0);

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
  JOIN _dup_termo d ON d.id = p.id
  ON CONFLICT ON CONSTRAINT idx_publicacoes_djen_descartadas_hash DO NOTHING;

  DELETE FROM public.publicacoes_djen WHERE id IN (SELECT id FROM _dup_termo);

  -- ============ publicacoes_djen_processos (processo) ============
  CREATE TEMP TABLE IF NOT EXISTS _dup_proc (id uuid PRIMARY KEY) ON COMMIT DROP;
  TRUNCATE _dup_proc;
  INSERT INTO _dup_proc (id)
  SELECT id FROM (
    SELECT id,
      ROW_NUMBER() OVER (
        PARTITION BY dedup_processo_digits, dedup_data_ref, dedup_head_norm
        ORDER BY created_at ASC, id ASC
      ) AS rn
    FROM public.publicacoes_djen_processos
    WHERE coordenacao_id = p_coordenacao_id
      AND dedup_processo_digits IS NOT NULL
      AND dedup_data_ref IS NOT NULL
      AND dedup_head_norm IS NOT NULL
  ) r WHERE rn > 1;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_total := v_total + COALESCE(v_count, 0);

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

  DELETE FROM public.publicacoes_djen_processos WHERE id IN (SELECT id FROM _dup_proc);

  RETURN jsonb_build_object(
    'lote_id', v_lote_id,
    'total', v_total,
    'descartado_por_nome', v_user_nome
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.descartar_duplicadas_coordenacao(uuid) TO authenticated;
