CREATE OR REPLACE FUNCTION public.descartar_duplicadas_coordenacao(p_coordenacao_id uuid, p_data_disp_inicio date DEFAULT NULL::date, p_data_disp_fim date DEFAULT NULL::date)
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
  v_data_inicio date;
  v_data_fim date;
  v_ts_inicio timestamptz;
  v_ts_fim_exclusive timestamptz;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  IF NOT (
    public.has_role(v_user_id, 'admin')
    OR EXISTS (
      SELECT 1 FROM public.membros_coordenacao mc
      WHERE mc.usuario_id = v_user_id AND mc.coordenacao_id = p_coordenacao_id
    )
  ) THEN
    RAISE EXCEPTION 'Sem permissão para esta coordenação';
  END IF;

  v_data_inicio := COALESCE(p_data_disp_inicio, p_data_disp_fim, (now() AT TIME ZONE 'America/Sao_Paulo')::date);
  v_data_fim := COALESCE(p_data_disp_fim, p_data_disp_inicio, (now() AT TIME ZONE 'America/Sao_Paulo')::date);

  IF v_data_fim < v_data_inicio THEN
    RAISE EXCEPTION 'Intervalo inválido para descarte de duplicadas';
  END IF;

  v_ts_inicio := v_data_inicio::timestamp AT TIME ZONE 'America/Sao_Paulo';
  v_ts_fim_exclusive := (v_data_fim + 1)::timestamp AT TIME ZONE 'America/Sao_Paulo';

  SELECT COALESCE(pr.nome, pr.email, 'Usuário') INTO v_user_nome
  FROM public.profiles pr WHERE pr.id = v_user_id;

  CREATE TEMP TABLE IF NOT EXISTS _dup_ids (id uuid PRIMARY KEY) ON COMMIT DROP;
  TRUNCATE _dup_ids;

  CREATE TEMP TABLE IF NOT EXISTS _dup_base (
    id uuid PRIMARY KEY,
    created_at timestamptz,
    coord_id uuid,
    fonte text,
    id_djen text,
    id_kurier bigint,
    processo_digits text,
    data_ref date,
    conteudo_hash text
  ) ON COMMIT DROP;
  TRUNCATE _dup_base;

  INSERT INTO _dup_base (id, created_at, coord_id, fonte, id_djen, id_kurier, processo_digits, data_ref, conteudo_hash)
  WITH base AS MATERIALIZED (
    SELECT pd.id, pd.created_at, COALESCE(pd.coordenacao_id, p_coordenacao_id) AS coord_id,
      pd.fonte, NULLIF(pd.id_djen, '') AS id_djen, pd.id_kurier,
      NULLIF(COALESCE(NULLIF(pd.dedup_processo_digits, ''), regexp_replace(COALESCE(pd.processo_numero, ''), '[^0-9]', '', 'g')), '') AS processo_digits,
      COALESCE(pd.data_disponibilizacao::date, pd.data_publicacao::date, pd.created_at::date) AS data_ref,
      pd.conteudo
    FROM public.publicacoes_djen pd
    WHERE pd.coordenacao_id = p_coordenacao_id
      AND pd.status IN ('encontrada', 'duplicada')
      AND (
        (pd.data_disponibilizacao >= v_ts_inicio AND pd.data_disponibilizacao < v_ts_fim_exclusive)
        OR (pd.data_publicacao >= v_ts_inicio AND pd.data_publicacao < v_ts_fim_exclusive)
        OR (pd.created_at >= v_ts_inicio AND pd.created_at < v_ts_fim_exclusive)
      )
    UNION ALL
    SELECT pd.id, pd.created_at, p_coordenacao_id AS coord_id,
      pd.fonte, NULLIF(pd.id_djen, '') AS id_djen, pd.id_kurier,
      NULLIF(COALESCE(NULLIF(pd.dedup_processo_digits, ''), regexp_replace(COALESCE(pd.processo_numero, ''), '[^0-9]', '', 'g')), '') AS processo_digits,
      COALESCE(pd.data_disponibilizacao::date, pd.data_publicacao::date, pd.created_at::date) AS data_ref,
      pd.conteudo
    FROM public.monitoramentos_djen md
    JOIN public.publicacoes_djen pd ON pd.monitoramento_id = md.id
    WHERE md.coordenacao_id = p_coordenacao_id
      AND pd.coordenacao_id IS NULL
      AND pd.status IN ('encontrada', 'duplicada')
      AND (
        (pd.data_disponibilizacao >= v_ts_inicio AND pd.data_disponibilizacao < v_ts_fim_exclusive)
        OR (pd.data_publicacao >= v_ts_inicio AND pd.data_publicacao < v_ts_fim_exclusive)
        OR (pd.created_at >= v_ts_inicio AND pd.created_at < v_ts_fim_exclusive)
      )
  )
  SELECT b.id, b.created_at, b.coord_id, b.fonte, b.id_djen, b.id_kurier,
    b.processo_digits, b.data_ref,
    md5(public.djen_normalize_conteudo_descarte_sem_intimados(b.conteudo)) AS conteudo_hash
  FROM base b
  WHERE b.processo_digits IS NOT NULL
    AND b.data_ref IS NOT NULL
    AND COALESCE(b.conteudo, '') <> ''
  ON CONFLICT (id) DO NOTHING;

  -- Passo 1: duplicadas por processo + dia + conteúdo normalizado (regra principal).
  INSERT INTO _dup_ids (id)
  WITH n AS (
    SELECT b.*, concat_ws('|', 'conteudo', b.coord_id::text, b.processo_digits, b.data_ref::text, b.conteudo_hash) AS grupo_key
    FROM _dup_base b
    WHERE b.conteudo_hash IS NOT NULL
  ), grupos AS (
    SELECT n.grupo_key FROM n GROUP BY n.grupo_key HAVING COUNT(*) > 1
  ), ranked AS (
    SELECT n.id, ROW_NUMBER() OVER (
      PARTITION BY n.grupo_key
      ORDER BY (CASE WHEN n.id_djen IS NOT NULL THEN 0 ELSE 1 END) ASC,
               (CASE WHEN n.fonte = 'kurier' THEN 0 ELSE 1 END) ASC,
               (CASE WHEN n.id_kurier IS NOT NULL THEN 0 ELSE 1 END) ASC,
               n.created_at ASC, n.id ASC
    ) AS rn
    FROM n JOIN grupos g ON g.grupo_key = n.grupo_key
  )
  SELECT r.id FROM ranked r WHERE r.rn > 1
  ON CONFLICT (id) DO NOTHING;

  -- Passo 2: duplicadas por mesmo id_djen (mesma comunicação capturada mais de uma vez),
  -- considerando apenas registros que sobraram do passo 1.
  INSERT INTO _dup_ids (id)
  WITH n AS (
    SELECT b.* FROM _dup_base b
    WHERE b.id_djen IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM _dup_ids d WHERE d.id = b.id)
  ), grupos AS (
    SELECT n.coord_id, n.id_djen FROM n GROUP BY n.coord_id, n.id_djen HAVING COUNT(*) > 1
  ), ranked AS (
    SELECT n.id, ROW_NUMBER() OVER (
      PARTITION BY n.coord_id, n.id_djen ORDER BY n.created_at ASC, n.id ASC
    ) AS rn
    FROM n JOIN grupos g ON g.coord_id = n.coord_id AND g.id_djen = n.id_djen
  )
  SELECT r.id FROM ranked r WHERE r.rn > 1
  ON CONFLICT (id) DO NOTHING;

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
    p.dedup_processo_digits, p.dedup_data_ref, p.dedup_head_norm, COALESCE(p.coordenacao_id, p_coordenacao_id), p.id_djen,
    v_user_id, v_user_nome, v_lote_id,
    'djen', p.id, to_jsonb(p.*)
  FROM public.publicacoes_djen p
  JOIN _dup_ids d ON d.id = p.id;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_total := COALESCE(v_count, 0);

  DELETE FROM public.publicacoes_djen p USING _dup_ids d WHERE p.id = d.id;

  RETURN jsonb_build_object(
    'success', true,
    'total', v_total,
    'total_descartadas', v_total,
    'lote_id', v_lote_id,
    'descartado_por_nome', v_user_nome,
    'data_inicio', v_data_inicio,
    'data_fim', v_data_fim,
    'regra', 'processo + dia + conteúdo normalizado (principal) e mesmo id_djen (secundário); janela por disponibilização, publicação ou captura'
  );
END;
$function$;