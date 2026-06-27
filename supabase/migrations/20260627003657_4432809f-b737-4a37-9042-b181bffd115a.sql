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

  CREATE TEMP TABLE IF NOT EXISTS _dup_termo (id uuid PRIMARY KEY) ON COMMIT DROP;
  TRUNCATE _dup_termo;

  INSERT INTO _dup_termo (id)
  SELECT id FROM (
    SELECT pd.id,
      ROW_NUMBER() OVER (
        PARTITION BY
          COALESCE(pd.coordenacao_id, md.coordenacao_id),
          regexp_replace(COALESCE(pd.processo_numero, ''), '\D', '', 'g'),
          lower(btrim(regexp_replace(COALESCE(pd.conteudo, ''), '\s+', ' ', 'g')))
        ORDER BY pd.created_at ASC, pd.id ASC
      ) AS rn
    FROM public.publicacoes_djen pd
    JOIN public.monitoramentos_djen md ON md.id = pd.monitoramento_id
    WHERE COALESCE(pd.coordenacao_id, md.coordenacao_id) = p_coordenacao_id
      AND pd.status IN ('encontrada','duplicada')
      AND regexp_replace(COALESCE(pd.processo_numero, ''), '\D', '', 'g') <> ''
      AND btrim(COALESCE(pd.conteudo, '')) <> ''
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

  CREATE TEMP TABLE IF NOT EXISTS _dup_proc (id uuid PRIMARY KEY) ON COMMIT DROP;
  TRUNCATE _dup_proc;

  INSERT INTO _dup_proc (id)
  SELECT id FROM (
    SELECT pdp.id,
      ROW_NUMBER() OVER (
        PARTITION BY
          pdp.coordenacao_id,
          regexp_replace(COALESCE(pdp.processo_numero, ''), '\D', '', 'g'),
          lower(btrim(regexp_replace(COALESCE(pdp.conteudo, ''), '\s+', ' ', 'g')))
        ORDER BY pdp.created_at ASC, pdp.id ASC
      ) AS rn
    FROM public.publicacoes_djen_processos pdp
    WHERE pdp.coordenacao_id = p_coordenacao_id
      AND pdp.status IN ('encontrada','duplicada')
      AND regexp_replace(COALESCE(pdp.processo_numero, ''), '\D', '', 'g') <> ''
      AND btrim(COALESCE(pdp.conteudo, '')) <> ''
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
    'data_fim', p_data_disp_fim,
    'regra', 'coordenacao+processo+conteudo_completo'
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.descartar_duplicadas_coordenacao_servidor(
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

  CREATE TEMP TABLE IF NOT EXISTS _dup_servidor (id uuid PRIMARY KEY) ON COMMIT DROP;
  TRUNCATE _dup_servidor;

  INSERT INTO _dup_servidor (id)
  SELECT id FROM (
    SELECT p.id,
      ROW_NUMBER() OVER (
        PARTITION BY
          p.coordenacao_id,
          regexp_replace(COALESCE(p.processo_numero, ''), '\D', '', 'g'),
          lower(btrim(regexp_replace(COALESCE(p.conteudo, ''), '\s+', ' ', 'g')))
        ORDER BY p.created_at ASC, p.id ASC
      ) AS rn
    FROM public.publicacoes_djen_servidor p
    WHERE p.coordenacao_id = p_coordenacao_id
      AND regexp_replace(COALESCE(p.processo_numero, ''), '\D', '', 'g') <> ''
      AND btrim(COALESCE(p.conteudo, '')) <> ''
      AND (
        p_data_disp_inicio IS NULL
        OR (COALESCE(p.data_publicacao, p.data_disponibilizacao, p.created_at) AT TIME ZONE 'America/Sao_Paulo')::date >= p_data_disp_inicio
      )
      AND (
        p_data_disp_fim IS NULL
        OR (COALESCE(p.data_publicacao, p.data_disponibilizacao, p.created_at) AT TIME ZONE 'America/Sao_Paulo')::date <= p_data_disp_fim
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
    false, p.orgao, p.tipo_comunicacao, p.meio, p.partes_json, p.advogados_json,
    p.dedup_processo_digits, p.dedup_data_ref, p.dedup_head_norm, p.coordenacao_id, p.id_djen,
    v_user_id, v_user_nome, v_lote_id,
    'servidor', p.id, to_jsonb(p.*)
  FROM public.publicacoes_djen_servidor p
  JOIN _dup_servidor d ON d.id = p.id;

  GET DIAGNOSTICS v_total = ROW_COUNT;
  DELETE FROM public.publicacoes_djen_servidor WHERE id IN (SELECT id FROM _dup_servidor);

  RETURN jsonb_build_object(
    'lote_id', v_lote_id,
    'total', v_total,
    'descartado_por_nome', v_user_nome,
    'data_inicio', p_data_disp_inicio,
    'data_fim', p_data_disp_fim,
    'regra', 'coordenacao+processo+conteudo_completo',
    'origem', 'servidor'
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.desfazer_descarte_lote(p_lote_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_termo_restaurado integer := 0;
  v_proc_restaurado integer := 0;
  v_servidor_restaurado integer := 0;
  r record;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  FOR r IN
    SELECT id, tipo_origem_origem, id_origem, payload_origem
    FROM public.publicacoes_djen_descartadas
    WHERE lote_descarte_id = p_lote_id
  LOOP
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
      v_termo_restaurado := v_termo_restaurado + 1;

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
      v_proc_restaurado := v_proc_restaurado + 1;

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
      v_servidor_restaurado := v_servidor_restaurado + 1;
    END IF;
  END LOOP;

  DELETE FROM public.publicacoes_djen_descartadas
  WHERE lote_descarte_id = p_lote_id;

  RETURN jsonb_build_object(
    'restaurado_termo', v_termo_restaurado,
    'restaurado_processo', v_proc_restaurado,
    'restaurado_servidor', v_servidor_restaurado,
    'total', v_termo_restaurado + v_proc_restaurado + v_servidor_restaurado
  );
END;
$function$;