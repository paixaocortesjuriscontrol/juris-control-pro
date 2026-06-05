CREATE OR REPLACE FUNCTION public.descartar_publicacao_manualmente(
  p_id uuid,
  p_tipo_origem text,
  p_motivo text DEFAULT 'descartado_manualmente'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inserted_id uuid;
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  IF p_tipo_origem = 'termo' THEN
    INSERT INTO public.publicacoes_djen_descartadas (
      monitoramento_id, hash_conteudo, data_publicacao, processo_numero,
      conteudo, fonte, motivo_descarte, data_disponibilizacao, tribunal,
      lida, orgao, tipo_comunicacao, meio, partes_json, advogados_json,
      dedup_processo_digits, dedup_data_ref, dedup_head_norm, coordenacao_id, id_djen
    )
    SELECT
      monitoramento_id, hash_conteudo, data_publicacao, processo_numero,
      conteudo, fonte, p_motivo, data_disponibilizacao, tribunal,
      lida, orgao, tipo_comunicacao, meio, partes_json, advogados_json,
      dedup_processo_digits, dedup_data_ref, dedup_head_norm, coordenacao_id, id_djen
    FROM public.publicacoes_djen
    WHERE id = p_id
    RETURNING id INTO v_inserted_id;

    DELETE FROM public.publicacoes_djen WHERE id = p_id;

  ELSIF p_tipo_origem = 'processo' THEN
    INSERT INTO public.publicacoes_djen_descartadas (
      monitoramento_id, hash_conteudo, data_publicacao, processo_numero,
      conteudo, fonte, motivo_descarte, data_disponibilizacao, tribunal,
      lida, orgao, tipo_comunicacao, meio, partes_json, advogados_json,
      dedup_processo_digits, dedup_data_ref, dedup_head_norm, coordenacao_id, id_djen
    )
    SELECT
      NULL, hash_conteudo, data_publicacao, processo_numero,
      conteudo, fonte, p_motivo, data_disponibilizacao, tribunal,
      lida, orgao, tipo_comunicacao, meio, partes_json, advogados_json,
      dedup_processo_digits, dedup_data_ref, dedup_head_norm, coordenacao_id, id_djen
    FROM public.publicacoes_djen_processos
    WHERE id = p_id
    RETURNING id INTO v_inserted_id;

    DELETE FROM public.publicacoes_djen_processos WHERE id = p_id;

  ELSE
    RAISE EXCEPTION 'tipo_origem não suportado para descarte manual: %', p_tipo_origem;
  END IF;

  RETURN jsonb_build_object('descartada_id', v_inserted_id, 'origem', p_tipo_origem);
END;
$$;

GRANT EXECUTE ON FUNCTION public.descartar_publicacao_manualmente(uuid, text, text) TO authenticated;