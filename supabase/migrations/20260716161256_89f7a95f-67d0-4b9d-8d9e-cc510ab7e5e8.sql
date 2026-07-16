CREATE OR REPLACE FUNCTION public.kurier_normalize_conteudo_sem_parte_intimacao(p_text text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $function$
  SELECT lower(
    btrim(
      regexp_replace(
        regexp_replace(
          regexp_replace(
            regexp_replace(
              regexp_replace(
                COALESCE(p_text, ''),
                '(?is)(^|[[:space:]])Parte[[:space:]]+intima[çc][ãa]o[[:space:]]+.*?(?=[[:space:]]+Advogado[[:space:]]+intima[çc][ãa]o\b|[[:space:]]+Advogados?[[:space:]]+polo\b|[[:space:]]+Data[[:space:]]+e[[:space:]]+hora\b|[[:space:]]+Identificador[[:space:]]+do[[:space:]]+documento\b|$)',
                ' ',
                'g'
              ),
              '(?is)(^|[[:space:]])Advogado[[:space:]]+intima[çc][ãa]o[[:space:]]+-?[[:space:]]*OAB[[:space:]]+advogado[[:space:]]+-?',
              ' ',
              'g'
            ),
            '<[^>]*>',
            ' ',
            'g'
          ),
          '[^[:alnum:][:space:]]+',
          ' ',
          'g'
        ),
        '[[:space:]]+',
        ' ',
        'g'
      )
    )
  );
$function$;

GRANT EXECUTE ON FUNCTION public.kurier_normalize_conteudo_sem_parte_intimacao(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.kurier_normalize_conteudo_sem_parte_intimacao(text) TO service_role;

CREATE OR REPLACE FUNCTION public.compute_djen_conteudo_dedup_key(
  p_coordenacao uuid,
  p_processo_numero text,
  p_data_disp timestamp with time zone,
  p_data_pub timestamp with time zone,
  p_created_at timestamp with time zone,
  p_conteudo text
)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $function$
DECLARE
  v_digits text;
  v_data date;
  v_norm text;
BEGIN
  v_digits := regexp_replace(COALESCE(p_processo_numero, ''), '[^0-9]', '', 'g');
  IF v_digits = '' THEN
    RETURN NULL;
  END IF;
  v_data := COALESCE(p_data_disp::date, p_data_pub::date, p_created_at::date);
  IF v_data IS NULL THEN
    RETURN NULL;
  END IF;

  IF COALESCE(p_conteudo, '') ~* 'Parte[[:space:]]+intima[çc][ãa]o|Advogados?[[:space:]]+polo' THEN
    v_norm := left(public.kurier_normalize_conteudo_sem_parte_intimacao(p_conteudo), 400);
  ELSE
    v_norm := left(public.djen_normalize_conteudo_sem_destinatarios(p_conteudo), 400);
  END IF;

  IF v_norm = '' THEN
    RETURN NULL;
  END IF;
  RETURN COALESCE(p_coordenacao::text, 'sem_coord') || '|' || v_digits || '|' || v_data::text || '|' || md5(v_norm);
END;
$function$;

CREATE OR REPLACE FUNCTION public.compute_dedup_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_base_norm text;
BEGIN
  NEW.dedup_processo_digits := regexp_replace(COALESCE(NEW.processo_numero, ''), '[^0-9]', '', 'g');
  NEW.dedup_data_ref := COALESCE(NEW.data_disponibilizacao::date, NEW.data_publicacao::date, NEW.created_at::date);

  IF COALESCE(NEW.fonte, '') = 'kurier'
     AND COALESCE(NEW.conteudo, '') ~* 'Parte[[:space:]]+intima[çc][ãa]o|Advogados?[[:space:]]+polo' THEN
    v_base_norm := public.kurier_normalize_conteudo_sem_parte_intimacao(NEW.conteudo);
  ELSE
    v_base_norm := COALESCE(public.strip_destinatarios(NEW.conteudo), '');
  END IF;

  NEW.dedup_head_norm := left(lower(regexp_replace(regexp_replace(regexp_replace(
    COALESCE(v_base_norm, ''), '<[^>]*>', ' ', 'g'), '[^\w\s]', ' ', 'g'), '\s+', ' ', 'g')), 300);

  NEW.dedup_key := public.compute_djen_dedup_key(
    NEW.coordenacao_id,
    NEW.processo_numero,
    NEW.data_disponibilizacao,
    NEW.data_publicacao,
    NEW.created_at
  );
  NEW.dedup_conteudo_key := public.compute_djen_conteudo_dedup_key(
    NEW.coordenacao_id,
    NEW.processo_numero,
    NEW.data_disponibilizacao,
    NEW.data_publicacao,
    NEW.created_at,
    NEW.conteudo
  );
  RETURN NEW;
END;
$function$;

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
      SELECT 1
      FROM public.membros_coordenacao mc
      WHERE mc.usuario_id = v_user_id
        AND mc.coordenacao_id = p_coordenacao_id
    )
  ) THEN
    RAISE EXCEPTION 'Sem permissão para esta coordenação';
  END IF;

  v_data_inicio := COALESCE(
    p_data_disp_inicio,
    p_data_disp_fim,
    (now() AT TIME ZONE 'America/Sao_Paulo')::date
  );
  v_data_fim := COALESCE(
    p_data_disp_fim,
    p_data_disp_inicio,
    (now() AT TIME ZONE 'America/Sao_Paulo')::date
  );

  v_ts_inicio := v_data_inicio::timestamp AT TIME ZONE 'America/Sao_Paulo';
  v_ts_fim_exclusive := (v_data_fim + 1)::timestamp AT TIME ZONE 'America/Sao_Paulo';

  SELECT COALESCE(pr.nome, pr.email, 'Usuário')
    INTO v_user_nome
  FROM public.profiles pr
  WHERE pr.id = v_user_id;

  CREATE TEMP TABLE IF NOT EXISTS _dup_ids (id uuid PRIMARY KEY) ON COMMIT DROP;
  TRUNCATE _dup_ids;

  INSERT INTO _dup_ids (id)
  WITH base AS MATERIALIZED (
    SELECT
      pd.id,
      pd.created_at,
      COALESCE(pd.coordenacao_id, p_coordenacao_id) AS coord_id,
      pd.fonte,
      pd.id_kurier,
      pd.kurier_login,
      NULLIF(COALESCE(NULLIF(pd.dedup_processo_digits, ''), regexp_replace(COALESCE(pd.processo_numero, ''), '[^0-9]', '', 'g')), '') AS processo_digits,
      pd.conteudo
    FROM public.publicacoes_djen pd
    WHERE pd.coordenacao_id = p_coordenacao_id
      AND pd.status IN ('encontrada', 'duplicada')
      AND COALESCE(pd.data_publicacao, pd.data_disponibilizacao, pd.created_at) >= v_ts_inicio
      AND COALESCE(pd.data_publicacao, pd.data_disponibilizacao, pd.created_at) < v_ts_fim_exclusive

    UNION ALL

    SELECT
      pd.id,
      pd.created_at,
      p_coordenacao_id AS coord_id,
      pd.fonte,
      pd.id_kurier,
      pd.kurier_login,
      NULLIF(COALESCE(NULLIF(pd.dedup_processo_digits, ''), regexp_replace(COALESCE(pd.processo_numero, ''), '[^0-9]', '', 'g')), '') AS processo_digits,
      pd.conteudo
    FROM public.monitoramentos_djen md
    JOIN public.publicacoes_djen pd ON pd.monitoramento_id = md.id
    WHERE md.coordenacao_id = p_coordenacao_id
      AND pd.coordenacao_id IS NULL
      AND pd.status IN ('encontrada', 'duplicada')
      AND COALESCE(pd.data_publicacao, pd.data_disponibilizacao, pd.created_at) >= v_ts_inicio
      AND COALESCE(pd.data_publicacao, pd.data_disponibilizacao, pd.created_at) < v_ts_fim_exclusive
  ), normalizados AS MATERIALIZED (
    SELECT
      b.id,
      b.created_at,
      b.coord_id,
      b.processo_digits,
      NULLIF(
        CASE
          WHEN b.fonte = 'kurier' AND b.conteudo ~* 'Parte[[:space:]]+intima[çc][ãa]o|Advogados?[[:space:]]+polo' THEN concat_ws('|',
            'kurier',
            b.coord_id::text,
            b.processo_digits,
            COALESCE(NULLIF(b.kurier_login, ''), 'sem_login'),
            md5(public.kurier_normalize_conteudo_sem_parte_intimacao(b.conteudo))
          )
          ELSE concat_ws('|',
            'djen',
            b.coord_id::text,
            b.processo_digits,
            md5(public.djen_normalize_conteudo_descarte_sem_intimados(b.conteudo))
          )
        END,
        ''
      ) AS grupo_key,
      CASE WHEN b.id_kurier IS NOT NULL THEN 0 ELSE 1 END AS prio_id_kurier
    FROM base b
    WHERE b.processo_digits IS NOT NULL
  ), grupos AS MATERIALIZED (
    SELECT n.grupo_key
    FROM normalizados n
    WHERE n.grupo_key IS NOT NULL
    GROUP BY n.grupo_key
    HAVING COUNT(*) > 1
  ), ranked AS (
    SELECT
      n.id,
      ROW_NUMBER() OVER (
        PARTITION BY n.grupo_key
        ORDER BY n.prio_id_kurier ASC, n.created_at ASC, n.id ASC
      ) AS rn
    FROM normalizados n
    JOIN grupos g ON g.grupo_key = n.grupo_key
  )
  SELECT r.id
  FROM ranked r
  WHERE r.rn > 1;

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

  DELETE FROM public.publicacoes_djen p
  USING _dup_ids d
  WHERE p.id = d.id;

  RETURN jsonb_build_object(
    'success', true,
    'total', v_total,
    'total_descartadas', v_total,
    'lote_id', v_lote_id,
    'descartado_por_nome', v_user_nome,
    'data_inicio', v_data_inicio,
    'data_fim', v_data_fim,
    'regra', 'kurier: mesma_coordenação + mesmo_processo + mesmo_login + mesmo_conteúdo_sem_parte_intimação; djen: mesmo_conteúdo_sem_intimados'
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.descartar_duplicadas_coordenacao(uuid, date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.descartar_duplicadas_coordenacao(uuid, date, date) TO service_role;