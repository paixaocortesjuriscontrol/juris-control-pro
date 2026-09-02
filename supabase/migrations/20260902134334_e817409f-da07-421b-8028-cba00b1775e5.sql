-- 1) Audiências não podem mais ser apagadas junto com a publicação
ALTER TABLE public.audiencias_detectadas
  DROP CONSTRAINT IF EXISTS audiencias_detectadas_publicacao_id_fkey;
ALTER TABLE public.audiencias_detectadas
  ADD CONSTRAINT audiencias_detectadas_publicacao_id_fkey
  FOREIGN KEY (publicacao_id) REFERENCES public.publicacoes_djen(id) ON DELETE SET NULL;

-- 2) Comentários da publicação passam a sobreviver ao descarte
ALTER TABLE public.comentarios_publicacoes_djen
  ALTER COLUMN publicacao_id DROP NOT NULL;
ALTER TABLE public.comentarios_publicacoes_djen
  DROP CONSTRAINT IF EXISTS comentarios_publicacoes_djen_publicacao_id_fkey;
ALTER TABLE public.comentarios_publicacoes_djen
  ADD CONSTRAINT comentarios_publicacoes_djen_publicacao_id_fkey
  FOREIGN KEY (publicacao_id) REFERENCES public.publicacoes_djen(id) ON DELETE SET NULL;

-- 3) Descarte manual: preservar itens e histórico antes de remover a linha
CREATE OR REPLACE FUNCTION public.descartar_publicacao_manualmente(
  p_id uuid,
  p_tipo_origem text,
  p_motivo text DEFAULT 'descartado_manualmente'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_inserted_id uuid;
  v_user_id uuid := auth.uid();
  v_user_nome text;
  v_payload jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  SELECT COALESCE(NULLIF(TRIM(p.nome), ''), p.email)
    INTO v_user_nome
  FROM public.profiles p
  WHERE p.id = v_user_id;

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
      tipo_origem_origem, id_origem, payload_origem,
      descartado_por, descartado_por_nome
    )
    SELECT
      monitoramento_id, hash_conteudo, data_publicacao, processo_numero,
      conteudo, fonte, p_motivo, data_disponibilizacao, tribunal,
      lida, orgao, tipo_comunicacao, meio, partes_json, advogados_json,
      dedup_processo_digits, dedup_data_ref, dedup_head_norm, coordenacao_id, id_djen,
      'termo', p_id, v_payload,
      v_user_id, v_user_nome
    FROM public.publicacoes_djen
    WHERE id = p_id
    RETURNING id INTO v_inserted_id;

    -- Preserva o conteúdo da publicação nas audiências geradas a partir dela
    UPDATE public.audiencias_detectadas a
       SET conteudo_publicacao = COALESCE(a.conteudo_publicacao, v_payload->>'conteudo')
     WHERE a.publicacao_id = p_id;

    -- Transfere o vínculo audiência <-> publicação para o registro descartado
    INSERT INTO public.audiencias_publicacoes_descartadas (audiencia_id, publicacao_descartada_id)
    SELECT ap.audiencia_id, v_inserted_id
      FROM public.audiencias_publicacoes ap
     WHERE ap.publicacao_id = p_id
    ON CONFLICT DO NOTHING;

    -- Desvincula explicitamente (a FK já é SET NULL, isto documenta a intenção)
    UPDATE public.audiencias_detectadas
       SET publicacao_id = NULL
     WHERE publicacao_id = p_id;

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
      tipo_origem_origem, id_origem, payload_origem,
      descartado_por, descartado_por_nome
    )
    SELECT
      NULL, hash_conteudo, data_publicacao, processo_numero,
      conteudo, fonte, p_motivo, data_disponibilizacao, tribunal,
      lida, orgao, tipo_comunicacao, meio, partes_json, advogados_json,
      dedup_processo_digits, dedup_data_ref, dedup_head_norm, coordenacao_id, id_djen,
      'processo', p_id, v_payload,
      v_user_id, v_user_nome
    FROM public.publicacoes_djen_processos
    WHERE id = p_id
    RETURNING id INTO v_inserted_id;

    INSERT INTO public.audiencias_publicacoes_descartadas (audiencia_id, publicacao_descartada_id)
    SELECT app.audiencia_id, v_inserted_id
      FROM public.audiencias_publicacoes_processos app
     WHERE app.publicacao_processo_id = p_id
    ON CONFLICT DO NOTHING;

    DELETE FROM public.publicacoes_djen_processos WHERE id = p_id;

  ELSE
    RAISE EXCEPTION 'tipo_origem não suportado para descarte manual: %', p_tipo_origem;
  END IF;

  RETURN jsonb_build_object('descartada_id', v_inserted_id, 'origem', p_tipo_origem);
END;
$function$;