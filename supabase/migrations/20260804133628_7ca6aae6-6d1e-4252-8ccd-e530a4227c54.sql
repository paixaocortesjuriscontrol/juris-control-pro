CREATE OR REPLACE FUNCTION public.desfazer_descarte_individual(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  r record;
  v_tipo text;
  v_payload jsonb;
  v_restaurado text := NULL;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  SELECT * INTO r
  FROM public.publicacoes_djen_descartadas
  WHERE id = p_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Publicação descartada não encontrada';
  END IF;

  IF NOT (
    public.has_role(v_user_id, 'admin')
    OR (r.coordenacao_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.membros_coordenacao
      WHERE usuario_id = v_user_id AND coordenacao_id = r.coordenacao_id
    ))
  ) THEN
    RAISE EXCEPTION 'Sem permissão para restaurar esta publicação';
  END IF;

  -- Tipo de origem: usa o gravado; se ausente, infere pelos dados da linha
  v_tipo := NULLIF(r.tipo_origem_origem, '');
  IF v_tipo IS NULL THEN
    IF r.monitoramento_id IS NOT NULL THEN
      v_tipo := 'termo';
    ELSIF r.processo_id IS NOT NULL THEN
      v_tipo := 'processo';
    ELSE
      v_tipo := 'termo';
    END IF;
  END IF;

  -- Payload de origem: usa o gravado; se ausente, reconstrói da própria linha
  v_payload := r.payload_origem;
  IF v_payload IS NULL OR v_payload = '{}'::jsonb THEN
    v_payload := jsonb_strip_nulls(jsonb_build_object(
      'id', COALESCE(r.id_origem, gen_random_uuid()),
      'monitoramento_id', r.monitoramento_id,
      'processo_id', r.processo_id,
      'hash_conteudo', r.hash_conteudo,
      'data_publicacao', r.data_publicacao,
      'data_disponibilizacao', r.data_disponibilizacao,
      'processo_numero', r.processo_numero,
      'conteudo', r.conteudo,
      'fonte', r.fonte,
      'tribunal', r.tribunal,
      'orgao', r.orgao,
      'tipo_comunicacao', r.tipo_comunicacao,
      'meio', r.meio,
      'partes_json', r.partes_json,
      'advogados_json', r.advogados_json,
      'dedup_processo_digits', r.dedup_processo_digits,
      'dedup_data_ref', r.dedup_data_ref,
      'dedup_head_norm', r.dedup_head_norm,
      'coordenacao_id', r.coordenacao_id,
      'id_djen', r.id_djen,
      'lida', COALESCE(r.lida, false),
      'created_at', r.created_at,
      'importada_de_descartada', true
    ));
  END IF;

  IF v_tipo = 'termo' THEN
    INSERT INTO public.publicacoes_djen (
      id, monitoramento_id, hash_conteudo, data_publicacao, processo_numero,
      conteudo, fonte, lida, created_at, data_disponibilizacao, tribunal,
      orgao, tipo_comunicacao, meio, partes_json, advogados_json,
      dedup_processo_digits, dedup_data_ref, dedup_head_norm, coordenacao_id, id_djen,
      polo_ativo, polo_passivo, status, dedup_key, tipo_publicacao,
      kurier_login, dedup_conteudo_key, publicacao_unica, importada_de_descartada,
      resumo_ia, resumo_gerado_em
    )
    SELECT
      COALESCE(NULLIF(v_payload->>'id','')::uuid, gen_random_uuid()),
      NULLIF(v_payload->>'monitoramento_id','')::uuid,
      v_payload->>'hash_conteudo',
      NULLIF(v_payload->>'data_publicacao','')::timestamptz,
      v_payload->>'processo_numero',
      v_payload->>'conteudo',
      v_payload->>'fonte',
      COALESCE((v_payload->>'lida')::boolean, false),
      COALESCE(NULLIF(v_payload->>'created_at','')::timestamptz, now()),
      NULLIF(v_payload->>'data_disponibilizacao','')::timestamptz,
      v_payload->>'tribunal',
      v_payload->>'orgao',
      v_payload->>'tipo_comunicacao',
      v_payload->>'meio',
      COALESCE(v_payload->'partes_json','[]'::jsonb),
      v_payload->'advogados_json',
      v_payload->>'dedup_processo_digits',
      NULLIF(v_payload->>'dedup_data_ref','')::date,
      v_payload->>'dedup_head_norm',
      NULLIF(v_payload->>'coordenacao_id','')::uuid,
      v_payload->>'id_djen',
      v_payload->>'polo_ativo',
      v_payload->>'polo_passivo',
      COALESCE((v_payload->>'status')::djen_status, 'encontrada'::djen_status),
      v_payload->>'dedup_key',
      COALESCE(v_payload->>'tipo_publicacao','intimacao'),
      v_payload->>'kurier_login',
      v_payload->>'dedup_conteudo_key',
      COALESCE((v_payload->>'publicacao_unica')::boolean, true),
      COALESCE((v_payload->>'importada_de_descartada')::boolean, true),
      v_payload->>'resumo_ia',
      NULLIF(v_payload->>'resumo_gerado_em','')::timestamptz
    ON CONFLICT (id) DO NOTHING;
    v_restaurado := 'termo';

  ELSIF v_tipo = 'processo' THEN
    INSERT INTO public.publicacoes_djen_processos (
      id, processo_id, processo_numero, conteudo, data_publicacao, data_encontrado,
      fonte, hash_conteudo, lida, created_at, data_disponibilizacao, orgao,
      tipo_comunicacao, meio, advogados_json, partes_json, tribunal,
      dedup_processo_digits, dedup_data_ref, dedup_head_norm, coordenacao_id,
      status, dedup_key, id_djen
    )
    SELECT
      COALESCE(NULLIF(v_payload->>'id','')::uuid, gen_random_uuid()),
      NULLIF(v_payload->>'processo_id','')::uuid,
      v_payload->>'processo_numero',
      v_payload->>'conteudo',
      NULLIF(v_payload->>'data_publicacao','')::timestamptz,
      COALESCE(NULLIF(v_payload->>'data_encontrado','')::timestamptz, now()),
      v_payload->>'fonte',
      v_payload->>'hash_conteudo',
      COALESCE((v_payload->>'lida')::boolean, false),
      COALESCE(NULLIF(v_payload->>'created_at','')::timestamptz, now()),
      NULLIF(v_payload->>'data_disponibilizacao','')::timestamptz,
      v_payload->>'orgao',
      v_payload->>'tipo_comunicacao',
      v_payload->>'meio',
      v_payload->'advogados_json',
      v_payload->'partes_json',
      v_payload->>'tribunal',
      v_payload->>'dedup_processo_digits',
      NULLIF(v_payload->>'dedup_data_ref','')::date,
      v_payload->>'dedup_head_norm',
      NULLIF(v_payload->>'coordenacao_id','')::uuid,
      COALESCE(v_payload->>'status','encontrada'),
      v_payload->>'dedup_key',
      v_payload->>'id_djen'
    ON CONFLICT (id) DO NOTHING;
    v_restaurado := 'processo';

  ELSIF v_tipo = 'servidor' THEN
    INSERT INTO public.publicacoes_djen_servidor (
      id, monitoramento_id, hash_conteudo, data_publicacao, data_disponibilizacao,
      processo_numero, conteudo, fonte, tribunal, polo_ativo, polo_passivo,
      orgao, tipo_comunicacao, meio, advogados_json, partes_json,
      dedup_processo_digits, dedup_data_ref, dedup_head_norm, dedup_key,
      dedup_conteudo_key, coordenacao_id, tipo_publicacao, id_djen,
      kurier_login, origem, execucao_id, created_at
    )
    SELECT
      COALESCE(NULLIF(v_payload->>'id','')::uuid, gen_random_uuid()),
      NULLIF(v_payload->>'monitoramento_id','')::uuid,
      v_payload->>'hash_conteudo',
      NULLIF(v_payload->>'data_publicacao','')::timestamptz,
      NULLIF(v_payload->>'data_disponibilizacao','')::timestamptz,
      v_payload->>'processo_numero',
      v_payload->>'conteudo',
      v_payload->>'fonte',
      v_payload->>'tribunal',
      v_payload->>'polo_ativo',
      v_payload->>'polo_passivo',
      v_payload->>'orgao',
      v_payload->>'tipo_comunicacao',
      v_payload->>'meio',
      COALESCE(v_payload->'advogados_json','[]'::jsonb),
      COALESCE(v_payload->'partes_json','[]'::jsonb),
      v_payload->>'dedup_processo_digits',
      NULLIF(v_payload->>'dedup_data_ref','')::date,
      v_payload->>'dedup_head_norm',
      v_payload->>'dedup_key',
      v_payload->>'dedup_conteudo_key',
      NULLIF(v_payload->>'coordenacao_id','')::uuid,
      COALESCE(v_payload->>'tipo_publicacao','intimacao'),
      v_payload->>'id_djen',
      v_payload->>'kurier_login',
      COALESCE(v_payload->>'origem','servidor'),
      NULLIF(v_payload->>'execucao_id','')::uuid,
      COALESCE(NULLIF(v_payload->>'created_at','')::timestamptz, now())
    ON CONFLICT (id) DO NOTHING;
    v_restaurado := 'servidor';
  ELSE
    RAISE EXCEPTION 'Tipo de origem desconhecido: %', v_tipo;
  END IF;

  DELETE FROM public.publicacoes_djen_descartadas WHERE id = p_id;

  RETURN jsonb_build_object('restaurado', v_restaurado, 'id', p_id);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.desfazer_descarte_individual(uuid) TO authenticated;