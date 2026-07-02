CREATE OR REPLACE FUNCTION public.get_djen_publicacoes_servidor_unificadas(
  p_coordenacao_id uuid DEFAULT NULL::uuid,
  p_inicio timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_fim timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_search_query text DEFAULT NULL::text,
  p_limit integer DEFAULT 500,
  p_offset integer DEFAULT 0,
  p_monitoramento_id uuid DEFAULT NULL::uuid,
  p_tipo_origem text DEFAULT NULL::text,
  p_read_status text DEFAULT 'todas'::text,
  p_data_disponibilizacao_inicio timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_data_disponibilizacao_fim timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_tribunal text DEFAULT NULL::text,
  p_dedup boolean DEFAULT false,
  p_apenas_hoje boolean DEFAULT false
)
RETURNS TABLE(
  id uuid,
  id_djen text,
  tipo_origem text,
  processo_id uuid,
  processo_numero text,
  conteudo text,
  data_publicacao timestamp with time zone,
  data_disponibilizacao timestamp with time zone,
  fonte text,
  lida boolean,
  created_at timestamp with time zone,
  monitoramento_id uuid,
  monitoramento_termo text,
  monitoramento_descricao text,
  monitoramento_tipo text,
  monitoramento_oab text,
  monitoramento_uf text,
  coordenacao_id uuid,
  coordenacao_nome text,
  polo_ativo text,
  polo_passivo text,
  tribunal text,
  orgao text,
  tipo_comunicacao text,
  meio text,
  advogados_json jsonb,
  partes_json jsonb,
  lido_por jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '8s'
AS $function$
DECLARE
  v_uid uuid;
  v_q text;
  v_q_digits text;
  v_tipo text;
  v_read text;
  v_is_admin boolean;
  v_tribunal text;
  v_dia_inicio timestamp with time zone;
  v_dia_fim timestamp with time zone;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '28000';
  END IF;

  v_is_admin := public.is_admin_or_coordenador(v_uid);
  IF p_coordenacao_id IS NOT NULL AND NOT v_is_admin
     AND NOT EXISTS (
       SELECT 1 FROM public.membros_coordenacao mc
       WHERE mc.coordenacao_id = p_coordenacao_id AND mc.usuario_id = v_uid
     )
  THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  v_tipo := NULLIF(btrim(COALESCE(p_tipo_origem, '')), '');
  IF v_tipo IN ('todos', 'normal') THEN v_tipo := NULL; END IF;
  v_read := COALESCE(NULLIF(btrim(p_read_status), ''), 'todas');
  v_q := NULLIF(btrim(p_search_query), '');
  v_q_digits := CASE WHEN v_q IS NOT NULL THEN regexp_replace(v_q, '[^0-9]', '', 'g') ELSE NULL END;
  IF v_q_digits IS NOT NULL AND length(v_q_digits) < 5 THEN v_q_digits := NULL; END IF;
  v_tribunal := NULLIF(regexp_replace(upper(COALESCE(p_tribunal, '')), '[^A-Z0-9]', '', 'g'), '');

  IF p_inicio IS NOT NULL THEN
    v_dia_inicio := ((p_inicio AT TIME ZONE 'America/Sao_Paulo')::date)::timestamp AT TIME ZONE 'UTC';
    v_dia_fim := (((p_inicio AT TIME ZONE 'America/Sao_Paulo')::date + 1)::timestamp AT TIME ZONE 'UTC') - interval '1 millisecond';
  END IF;

  RETURN QUERY
  WITH base AS (
    SELECT
      ps.id,
      ps.id_djen,
      'termo'::text AS tipo_origem,
      NULL::uuid AS processo_id,
      ps.processo_numero,
      ps.conteudo,
      ps.data_publicacao,
      ps.data_disponibilizacao,
      ps.fonte,
      ps.created_at,
      ps.monitoramento_id,
      md.termo_busca AS monitoramento_termo,
      md.descricao AS monitoramento_descricao,
      md.tipo AS monitoramento_tipo,
      md.oab AS monitoramento_oab,
      md.uf AS monitoramento_uf,
      COALESCE(ps.coordenacao_id, md.coordenacao_id) AS coordenacao_id,
      c.nome AS coordenacao_nome,
      ps.polo_ativo,
      ps.polo_passivo,
      ps.tribunal,
      ps.orgao,
      ps.tipo_comunicacao,
      ps.meio,
      ps.advogados_json,
      ps.partes_json,
      EXISTS (
        SELECT 1 FROM public.publicacoes_djen_leituras l
        WHERE l.publicacao_id = ps.id
          AND l.tabela_origem = 'termo'
          AND l.usuario_id = v_uid
      ) AS lida_por_user,
      CASE
        WHEN NULLIF(btrim(ps.id_djen), '') IS NOT NULL THEN 'id_djen|' || btrim(ps.id_djen)
        WHEN NULLIF(btrim(ps.dedup_key), '') IS NOT NULL THEN 'dedup|' || btrim(ps.dedup_key)
        ELSE 'row|' || ps.id::text
      END AS dedup_uid
    FROM public.publicacoes_djen_servidor ps
    LEFT JOIN public.monitoramentos_djen md ON md.id = ps.monitoramento_id
    LEFT JOIN public.coordenacoes c ON c.id = COALESCE(ps.coordenacao_id, md.coordenacao_id)
    WHERE (v_tipo IS NULL OR v_tipo IN ('termo', 'parte', 'djet-pautas', 'kurier'))
      AND (v_tipo IS DISTINCT FROM 'parte' OR lower(COALESCE(md.tipo, '')) = 'parte')
      AND (v_tipo IS DISTINCT FROM 'djet-pautas' OR ps.tipo_publicacao = 'pauta')
      AND (v_tipo IS DISTINCT FROM 'kurier' OR lower(COALESCE(ps.fonte, ps.origem, '')) = 'kurier')
      AND (v_tipo = 'djet-pautas' OR COALESCE(ps.tipo_publicacao, '') <> 'pauta')
      AND (p_monitoramento_id IS NULL OR ps.monitoramento_id = p_monitoramento_id)
      AND (
        p_coordenacao_id IS NULL
        OR ps.coordenacao_id = p_coordenacao_id
        OR (ps.coordenacao_id IS NULL AND md.coordenacao_id = p_coordenacao_id)
      )
      AND (
        v_is_admin
        OR EXISTS (
          SELECT 1 FROM public.membros_coordenacao mc
          WHERE mc.coordenacao_id = COALESCE(ps.coordenacao_id, md.coordenacao_id)
            AND mc.usuario_id = v_uid
        )
      )
      AND (
        p_inicio IS NULL OR
        CASE
          WHEN p_apenas_hoje THEN (
            (
              lower(COALESCE(ps.fonte, '')) = 'kurier'
              AND (
                (ps.data_disponibilizacao >= v_dia_inicio AND ps.data_disponibilizacao <= v_dia_fim)
                OR (ps.data_disponibilizacao IS NULL AND ps.created_at >= p_inicio AND (p_fim IS NULL OR ps.created_at <= p_fim))
              )
            ) OR (
              lower(COALESCE(ps.fonte, '')) <> 'kurier' OR ps.fonte IS NULL
            ) AND (
              (p_fim IS NOT NULL AND ps.data_publicacao >= p_inicio AND ps.data_publicacao <= p_fim)
              OR (ps.data_publicacao >= v_dia_inicio AND ps.data_publicacao <= v_dia_fim)
              OR (p_fim IS NOT NULL AND ps.data_disponibilizacao >= p_inicio AND ps.data_disponibilizacao <= p_fim)
              OR (ps.data_disponibilizacao >= v_dia_inicio AND ps.data_disponibilizacao <= v_dia_fim)
              OR (ps.data_publicacao IS NULL AND ps.data_disponibilizacao IS NULL AND ps.created_at >= p_inicio AND (p_fim IS NULL OR ps.created_at <= p_fim))
            )
          )
          ELSE ps.created_at >= p_inicio
        END
      )
      AND (p_fim IS NULL OR p_apenas_hoje OR ps.created_at <= p_fim)
      AND (
        p_data_disponibilizacao_inicio IS NULL
        OR (
          v_tipo = 'djet-pautas'
          AND ps.data_disponibilizacao >= (((p_data_disponibilizacao_inicio AT TIME ZONE 'UTC')::date)::timestamp AT TIME ZONE 'UTC')
        )
        OR (v_tipo IS DISTINCT FROM 'djet-pautas' AND ps.data_disponibilizacao >= p_data_disponibilizacao_inicio)
      )
      AND (
        p_data_disponibilizacao_fim IS NULL
        OR (
          v_tipo = 'djet-pautas'
          AND ps.data_disponibilizacao <= ((((p_data_disponibilizacao_fim AT TIME ZONE 'UTC')::date + 1)::timestamp AT TIME ZONE 'UTC') - interval '1 millisecond')
        )
        OR (v_tipo IS DISTINCT FROM 'djet-pautas' AND ps.data_disponibilizacao <= p_data_disponibilizacao_fim)
      )
      AND (v_tribunal IS NULL OR upper(COALESCE(ps.tribunal, ps.fonte, '')) ~ ('(^|[^A-Z0-9])' || v_tribunal || '([^A-Z0-9]|$)'))
      AND (
        v_q IS NULL
        OR ps.conteudo ILIKE ('%' || v_q || '%')
        OR ps.processo_numero ILIKE ('%' || v_q || '%')
        OR md.termo_busca ILIKE ('%' || v_q || '%')
        OR (v_q_digits IS NOT NULL AND regexp_replace(COALESCE(ps.processo_numero, ''), '[^0-9]', '', 'g') LIKE ('%' || v_q_digits || '%'))
      )
  ),
  read_filtered AS (
    SELECT b.*
    FROM base b
    WHERE v_read = 'todas'
      OR (v_read = 'nao_lidas' AND NOT b.lida_por_user)
      OR (v_read = 'lidas' AND b.lida_por_user)
  ),
  deduped AS (
    SELECT DISTINCT ON (rf.coordenacao_id, rf.dedup_uid) rf.*
    FROM read_filtered rf
    WHERE p_dedup = true
    ORDER BY rf.coordenacao_id, rf.dedup_uid, rf.lida_por_user ASC, rf.created_at DESC, rf.id ASC
  ),
  all_rows AS (
    SELECT rf.* FROM read_filtered rf WHERE p_dedup = false
    UNION ALL
    SELECT d.* FROM deduped d
  ),
  page_rows AS (
    SELECT ar.*
    FROM all_rows ar
    ORDER BY ar.created_at DESC, ar.id ASC
    LIMIT GREATEST(p_limit, 1)
    OFFSET GREATEST(p_offset, 0)
  )
  SELECT
    pr.id,
    pr.id_djen,
    pr.tipo_origem,
    pr.processo_id,
    pr.processo_numero,
    pr.conteudo,
    pr.data_publicacao,
    pr.data_disponibilizacao,
    pr.fonte,
    pr.lida_por_user,
    pr.created_at,
    pr.monitoramento_id,
    pr.monitoramento_termo,
    pr.monitoramento_descricao,
    pr.monitoramento_tipo,
    pr.monitoramento_oab,
    pr.monitoramento_uf,
    pr.coordenacao_id,
    pr.coordenacao_nome,
    pr.polo_ativo,
    pr.polo_passivo,
    pr.tribunal,
    pr.orgao,
    pr.tipo_comunicacao,
    pr.meio,
    pr.advogados_json,
    pr.partes_json,
    COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object('nome', COALESCE(l.usuario_nome, 'Desconhecido'), 'lida_em', l.lida_em)
        ORDER BY l.lida_em DESC
      )
      FROM public.publicacoes_djen_leituras l
      WHERE l.publicacao_id = pr.id
        AND l.tabela_origem = 'termo'
    ), '[]'::jsonb) AS lido_por
  FROM page_rows pr
  ORDER BY pr.created_at DESC, pr.id ASC;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_djen_publicacoes_servidor_unificadas(uuid, timestamp with time zone, timestamp with time zone, text, integer, integer, uuid, text, text, timestamp with time zone, timestamp with time zone, text, boolean, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_djen_publicacoes_servidor_unificadas(uuid, timestamp with time zone, timestamp with time zone, text, integer, integer, uuid, text, text, timestamp with time zone, timestamp with time zone, text, boolean, boolean) TO service_role;

CREATE INDEX IF NOT EXISTS idx_pds_coord_created_desc
  ON public.publicacoes_djen_servidor (coordenacao_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_pds_monitoramento_created_desc
  ON public.publicacoes_djen_servidor (monitoramento_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_pds_tipo_publicacao_created_desc
  ON public.publicacoes_djen_servidor (tipo_publicacao, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_pds_data_publicacao_desc
  ON public.publicacoes_djen_servidor (data_publicacao DESC);

CREATE INDEX IF NOT EXISTS idx_pds_data_disponibilizacao_desc
  ON public.publicacoes_djen_servidor (data_disponibilizacao DESC);

CREATE INDEX IF NOT EXISTS idx_pds_id_djen_coord
  ON public.publicacoes_djen_servidor (coordenacao_id, id_djen)
  WHERE id_djen IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_djen_leituras_servidor_lookup
  ON public.publicacoes_djen_leituras (usuario_id, tabela_origem, publicacao_id);