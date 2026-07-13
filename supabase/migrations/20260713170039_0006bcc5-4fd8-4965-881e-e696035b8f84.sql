CREATE OR REPLACE FUNCTION public.descartar_publicacao_manualmente(p_id uuid, p_tipo_origem text, p_motivo text DEFAULT 'descartado_manualmente'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_inserted_id uuid;
  v_user_id uuid := auth.uid();
  v_payload jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  IF p_tipo_origem = 'termo' THEN
    SELECT to_jsonb(t) INTO v_payload FROM public.publicacoes_djen t WHERE id = p_id;
    IF v_payload IS NULL THEN
      RAISE EXCEPTION 'Publicação (termo) não encontrada: %', p_id;
    END IF;

    INSERT INTO public.publicacoes_djen_descartadas (
      monitoramento_id, hash_conteudo, data_publicacao, processo_numero,
      conteudo, fonte, motivo_descarte, data_disponibilizacao, tribunal,
      lida, orgao, tipo_comunicacao, meio, partes_json, advogados_json,
      dedup_processo_digits, dedup_data_ref, dedup_head_norm, coordenacao_id, id_djen,
      tipo_origem_origem, id_origem, payload_origem
    )
    SELECT
      monitoramento_id, hash_conteudo, data_publicacao, processo_numero,
      conteudo, fonte, p_motivo, data_disponibilizacao, tribunal,
      lida, orgao, tipo_comunicacao, meio, partes_json, advogados_json,
      dedup_processo_digits, dedup_data_ref, dedup_head_norm, coordenacao_id, id_djen,
      'termo', p_id, v_payload
    FROM public.publicacoes_djen
    WHERE id = p_id
    RETURNING id INTO v_inserted_id;

    DELETE FROM public.publicacoes_djen WHERE id = p_id;

  ELSIF p_tipo_origem = 'processo' THEN
    SELECT to_jsonb(t) INTO v_payload FROM public.publicacoes_djen_processos t WHERE id = p_id;
    IF v_payload IS NULL THEN
      RAISE EXCEPTION 'Publicação (processo) não encontrada: %', p_id;
    END IF;

    INSERT INTO public.publicacoes_djen_descartadas (
      monitoramento_id, hash_conteudo, data_publicacao, processo_numero,
      conteudo, fonte, motivo_descarte, data_disponibilizacao, tribunal,
      lida, orgao, tipo_comunicacao, meio, partes_json, advogados_json,
      dedup_processo_digits, dedup_data_ref, dedup_head_norm, coordenacao_id, id_djen,
      tipo_origem_origem, id_origem, payload_origem
    )
    SELECT
      NULL, hash_conteudo, data_publicacao, processo_numero,
      conteudo, fonte, p_motivo, data_disponibilizacao, tribunal,
      lida, orgao, tipo_comunicacao, meio, partes_json, advogados_json,
      dedup_processo_digits, dedup_data_ref, dedup_head_norm, coordenacao_id, id_djen,
      'processo', p_id, v_payload
    FROM public.publicacoes_djen_processos
    WHERE id = p_id
    RETURNING id INTO v_inserted_id;

    DELETE FROM public.publicacoes_djen_processos WHERE id = p_id;

  ELSE
    RAISE EXCEPTION 'tipo_origem não suportado para descarte manual: %', p_tipo_origem;
  END IF;

  RETURN jsonb_build_object('descartada_id', v_inserted_id, 'origem', p_tipo_origem);
END;
$function$;