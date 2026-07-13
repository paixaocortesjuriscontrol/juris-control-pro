
CREATE OR REPLACE FUNCTION public.desfazer_descarte_individual(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  r record;
  v_restaurado text := NULL;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  SELECT id, tipo_origem_origem, id_origem, payload_origem, coordenacao_id
    INTO r
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

  IF r.tipo_origem_origem = 'termo' THEN
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
      (r.payload_origem->>'id')::uuid,
      NULLIF(r.payload_origem->>'monitoramento_id','')::uuid,
      r.payload_origem->>'hash_conteudo',
      NULLIF(r.payload_origem->>'data_publicacao','')::timestamptz,
      r.payload_origem->>'processo_numero',
      r.payload_origem->>'conteudo',
      r.payload_origem->>'fonte',
      COALESCE((r.payload_origem->>'lida')::boolean, false),
      COALESCE(NULLIF(r.payload_origem->>'created_at','')::timestamptz, now()),
      NULLIF(r.payload_origem->>'data_disponibilizacao','')::timestamptz,
      r.payload_origem->>'tribunal',
      r.payload_origem->>'orgao',
      r.payload_origem->>'tipo_comunicacao',
      r.payload_origem->>'meio',
      COALESCE(r.payload_origem->'partes_json','[]'::jsonb),
      r.payload_origem->'advogados_json',
      r.payload_origem->>'dedup_processo_digits',
      NULLIF(r.payload_origem->>'dedup_data_ref','')::date,
      r.payload_origem->>'dedup_head_norm',
      NULLIF(r.payload_origem->>'coordenacao_id','')::uuid,
      r.payload_origem->>'id_djen',
      r.payload_origem->>'polo_ativo',
      r.payload_origem->>'polo_passivo',
      COALESCE((r.payload_origem->>'status')::djen_status, 'encontrada'::djen_status),
      r.payload_origem->>'dedup_key',
      COALESCE(r.payload_origem->>'tipo_publicacao','intimacao'),
      r.payload_origem->>'kurier_login',
      r.payload_origem->>'dedup_conteudo_key',
      COALESCE((r.payload_origem->>'publicacao_unica')::boolean, true),
      COALESCE((r.payload_origem->>'importada_de_descartada')::boolean, false),
      r.payload_origem->>'resumo_ia',
      NULLIF(r.payload_origem->>'resumo_gerado_em','')::timestamptz
    ON CONFLICT (id) DO NOTHING;
    v_restaurado := 'termo';

  ELSIF r.tipo_origem_origem = 'processo' THEN
    INSERT INTO public.publicacoes_djen_processos (
      id, processo_id, processo_numero, conteudo, data_publicacao, data_encontrado,
      fonte, hash_conteudo, lida, created_at, data_disponibilizacao, orgao,
      tipo_comunicacao, meio, advogados_json, partes_json, tribunal,
      dedup_processo_digits, dedup_data_ref, dedup_head_norm, coordenacao_id,
      status, dedup_key, id_djen
    )
    SELECT
      (r.payload_origem->>'id')::uuid,
      (r.payload_origem->>'processo_id')::uuid,
      r.payload_origem->>'processo_numero',
      r.payload_origem->>'conteudo',
      NULLIF(r.payload_origem->>'data_publicacao','')::timestamptz,
      COALESCE(NULLIF(r.payload_origem->>'data_encontrado','')::timestamptz, now()),
      r.payload_origem->>'fonte',
      r.payload_origem->>'hash_conteudo',
      COALESCE((r.payload_origem->>'lida')::boolean, false),
      COALESCE(NULLIF(r.payload_origem->>'created_at','')::timestamptz, now()),
      NULLIF(r.payload_origem->>'data_disponibilizacao','')::timestamptz,
      r.payload_origem->>'orgao',
      r.payload_origem->>'tipo_comunicacao',
      r.payload_origem->>'meio',
      r.payload_origem->'advogados_json',
      r.payload_origem->'partes_json',
      r.payload_origem->>'tribunal',
      r.payload_origem->>'dedup_processo_digits',
      NULLIF(r.payload_origem->>'dedup_data_ref','')::date,
      r.payload_origem->>'dedup_head_norm',
      NULLIF(r.payload_origem->>'coordenacao_id','')::uuid,
      COALESCE(r.payload_origem->>'status','encontrada'),
      r.payload_origem->>'dedup_key',
      r.payload_origem->>'id_djen'
    ON CONFLICT (id) DO NOTHING;
    v_restaurado := 'processo';

  ELSIF r.tipo_origem_origem = 'servidor' THEN
    INSERT INTO public.publicacoes_djen_servidor (
      id, monitoramento_id, hash_conteudo, data_publicacao, data_disponibilizacao,
      processo_numero, conteudo, fonte, tribunal, polo_ativo, polo_passivo,
      orgao, tipo_comunicacao, meio, advogados_json, partes_json,
      dedup_processo_digits, dedup_data_ref, dedup_head_norm, dedup_key,
      dedup_conteudo_key, coordenacao_id, tipo_publicacao, id_djen,
      kurier_login, origem, execucao_id, created_at
    )
    SELECT
      (r.payload_origem->>'id')::uuid,
      NULLIF(r.payload_origem->>'monitoramento_id','')::uuid,
      r.payload_origem->>'hash_conteudo',
      NULLIF(r.payload_origem->>'data_publicacao','')::timestamptz,
      NULLIF(r.payload_origem->>'data_disponibilizacao','')::timestamptz,
      r.payload_origem->>'processo_numero',
      r.payload_origem->>'conteudo',
      r.payload_origem->>'fonte',
      r.payload_origem->>'tribunal',
      r.payload_origem->>'polo_ativo',
      r.payload_origem->>'polo_passivo',
      r.payload_origem->>'orgao',
      r.payload_origem->>'tipo_comunicacao',
      r.payload_origem->>'meio',
      COALESCE(r.payload_origem->'advogados_json','[]'::jsonb),
      COALESCE(r.payload_origem->'partes_json','[]'::jsonb),
      r.payload_origem->>'dedup_processo_digits',
      NULLIF(r.payload_origem->>'dedup_data_ref','')::date,
      r.payload_origem->>'dedup_head_norm',
      r.payload_origem->>'dedup_key',
      r.payload_origem->>'dedup_conteudo_key',
      NULLIF(r.payload_origem->>'coordenacao_id','')::uuid,
      COALESCE(r.payload_origem->>'tipo_publicacao','intimacao'),
      r.payload_origem->>'id_djen',
      r.payload_origem->>'kurier_login',
      COALESCE(r.payload_origem->>'origem','servidor'),
      NULLIF(r.payload_origem->>'execucao_id','')::uuid,
      COALESCE(NULLIF(r.payload_origem->>'created_at','')::timestamptz, now())
    ON CONFLICT (id) DO NOTHING;
    v_restaurado := 'servidor';
  ELSE
    RAISE EXCEPTION 'Tipo de origem desconhecido: %', r.tipo_origem_origem;
  END IF;

  DELETE FROM public.publicacoes_djen_descartadas WHERE id = p_id;

  RETURN jsonb_build_object(
    'restaurado', v_restaurado,
    'id', p_id
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.desfazer_descarte_individual(uuid) TO authenticated;
