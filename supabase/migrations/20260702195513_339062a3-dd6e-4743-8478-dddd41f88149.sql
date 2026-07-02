
CREATE OR REPLACE FUNCTION public.get_djen_descartadas_dedup(
  p_coordenacao_id uuid DEFAULT NULL::uuid,
  p_inicio timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_fim timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_data_disponibilizacao_inicio timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_data_disponibilizacao_fim timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_apenas_hoje boolean DEFAULT false,
  p_search_query text DEFAULT NULL::text,
  p_limit integer DEFAULT 500,
  p_offset integer DEFAULT 0,
  p_monitoramento_id uuid DEFAULT NULL::uuid,
  p_read_status text DEFAULT 'todas'::text
)
RETURNS TABLE(
  id uuid, processo_numero text, conteudo text,
  data_publicacao timestamp with time zone, data_disponibilizacao timestamp with time zone,
  fonte text, lida boolean, created_at timestamp with time zone,
  monitoramento_id uuid, monitoramento_termo text, monitoramento_descricao text,
  monitoramento_tipo text, monitoramento_oab text, monitoramento_uf text,
  coordenacao_id uuid, coordenacao_nome text, tribunal text, orgao text,
  tipo_comunicacao text, meio text, advogados_json jsonb, partes_json jsonb,
  motivo_descarte text, descartado_por uuid, descartado_por_nome text,
  lido_por jsonb, total_count bigint
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid; v_q text; v_q_digits text; v_read text; v_is_admin boolean;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not authenticated' USING ERRCODE = '28000'; END IF;
  v_is_admin := public.is_admin_or_coordenador(v_uid);
  IF p_coordenacao_id IS NOT NULL AND NOT v_is_admin
     AND NOT EXISTS (SELECT 1 FROM public.membros_coordenacao mc WHERE mc.coordenacao_id = p_coordenacao_id AND mc.usuario_id = v_uid)
  THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;

  v_read := COALESCE(NULLIF(btrim(p_read_status), ''), 'todas');
  v_q := NULLIF(btrim(COALESCE(p_search_query, '')), '');
  v_q_digits := CASE WHEN v_q IS NOT NULL THEN regexp_replace(v_q, '[^0-9]', '', 'g') ELSE NULL END;
  IF v_q_digits IS NOT NULL AND length(v_q_digits) < 5 THEN v_q_digits := NULL; END IF;

  RETURN QUERY
  WITH base AS (
    SELECT
      d.id, d.processo_numero, d.conteudo, d.data_publicacao, d.data_disponibilizacao,
      d.fonte, d.lida, d.created_at, d.monitoramento_id,
      md.termo_busca AS monitoramento_termo, md.descricao AS monitoramento_descricao,
      md.tipo AS monitoramento_tipo, md.oab AS monitoramento_oab, md.uf AS monitoramento_uf,
      COALESCE(d.coordenacao_id, md.coordenacao_id) AS coordenacao_id,
      c.nome AS coordenacao_nome,
      d.tribunal, d.orgao, d.tipo_comunicacao, d.meio,
      d.advogados_json, d.partes_json, d.motivo_descarte,
      d.descartado_por, d.descartado_por_nome,
      COALESCE(d.coordenacao_id, md.coordenacao_id) AS dedup_coord,
      COALESCE(
        NULLIF(btrim(d.id_djen), ''),
        concat_ws('|', 'legacy', d.dedup_processo_digits, d.dedup_data_ref::text, d.dedup_head_norm)
      ) AS dedup_uid
    FROM public.publicacoes_djen_descartadas d
    LEFT JOIN public.monitoramentos_djen md ON md.id = d.monitoramento_id
    LEFT JOIN public.coordenacoes c ON c.id = COALESCE(d.coordenacao_id, md.coordenacao_id)
    WHERE (p_coordenacao_id IS NULL OR COALESCE(d.coordenacao_id, md.coordenacao_id) = p_coordenacao_id)
      AND (
        v_is_admin OR EXISTS (
          SELECT 1 FROM public.membros_coordenacao mc
          WHERE mc.coordenacao_id = COALESCE(d.coordenacao_id, md.coordenacao_id) AND mc.usuario_id = v_uid
        )
      )
      AND d.motivo_descarte <> 'termo_nao_encontrado'
      AND (p_monitoramento_id IS NULL OR d.monitoramento_id = p_monitoramento_id)
      AND (
        (v_q_digits IS NOT NULL AND length(v_q_digits) >= 11 AND regexp_replace(COALESCE(d.processo_numero, ''), '[^0-9]', '', 'g') LIKE ('%' || v_q_digits || '%'))
        OR (
          NOT (v_q_digits IS NOT NULL AND length(v_q_digits) >= 11)
          AND (
            p_inicio IS NULL
            OR CASE
              WHEN p_apenas_hoje AND lower(COALESCE(d.fonte, '')) = 'kurier'
                THEN COALESCE((d.data_disponibilizacao AT TIME ZONE 'UTC')::date, (d.created_at AT TIME ZONE 'America/Sao_Paulo')::date) >= (p_inicio AT TIME ZONE 'America/Sao_Paulo')::date
              WHEN p_apenas_hoje THEN d.data_publicacao >= p_inicio
              ELSE d.created_at >= p_inicio
            END
          )
          AND (
            p_fim IS NULL
            OR CASE
              WHEN p_apenas_hoje AND lower(COALESCE(d.fonte, '')) = 'kurier'
                THEN COALESCE((d.data_disponibilizacao AT TIME ZONE 'UTC')::date, (d.created_at AT TIME ZONE 'America/Sao_Paulo')::date) <= (p_fim AT TIME ZONE 'America/Sao_Paulo')::date
              WHEN p_apenas_hoje THEN d.data_publicacao <= p_fim
              ELSE d.created_at <= p_fim
            END
          )
          AND (p_data_disponibilizacao_inicio IS NULL OR d.data_disponibilizacao >= p_data_disponibilizacao_inicio)
          AND (p_data_disponibilizacao_fim IS NULL OR d.data_disponibilizacao <= p_data_disponibilizacao_fim)
        )
      )
      AND (
        v_q IS NULL
        OR d.conteudo ILIKE ('%' || v_q || '%')
        OR d.processo_numero ILIKE ('%' || v_q || '%')
        OR md.termo_busca ILIKE ('%' || v_q || '%')
        OR d.motivo_descarte ILIKE ('%' || v_q || '%')
        OR d.descartado_por_nome ILIKE ('%' || v_q || '%')
        OR (v_q_digits IS NOT NULL AND regexp_replace(COALESCE(d.processo_numero, ''), '[^0-9]', '', 'g') LIKE ('%' || v_q_digits || '%'))
      )
  ),
  ranked AS (
    SELECT DISTINCT ON (b.dedup_coord, b.dedup_uid) b.*
    FROM base b
    ORDER BY b.dedup_coord, b.dedup_uid, length(COALESCE(b.conteudo, '')) DESC, b.created_at DESC, b.id DESC
  ),
  filtered AS (
    SELECT r.*,
      EXISTS (
        SELECT 1 FROM public.publicacoes_djen_leituras l
        WHERE l.publicacao_id = r.id AND l.tabela_origem = 'descartada' AND l.usuario_id = v_uid
      ) AS lida_por_user
    FROM ranked r
  ),
  visible AS (
    SELECT f.* FROM filtered f
    WHERE v_read = 'todas' OR (v_read = 'nao_lidas' AND NOT f.lida_por_user) OR (v_read = 'lidas' AND f.lida_por_user)
  ),
  counted AS (SELECT v.*, COUNT(*) OVER() AS total_count FROM visible v)
  SELECT
    c.id, c.processo_numero, c.conteudo, c.data_publicacao, c.data_disponibilizacao,
    c.fonte, c.lida_por_user, c.created_at,
    c.monitoramento_id, c.monitoramento_termo, c.monitoramento_descricao,
    c.monitoramento_tipo, c.monitoramento_oab, c.monitoramento_uf,
    c.coordenacao_id, c.coordenacao_nome,
    c.tribunal, c.orgao, c.tipo_comunicacao, c.meio,
    c.advogados_json, c.partes_json, c.motivo_descarte,
    c.descartado_por, c.descartado_por_nome,
    COALESCE((
      SELECT jsonb_agg(jsonb_build_object('nome', COALESCE(l.usuario_nome, 'Desconhecido'), 'lida_em', l.lida_em) ORDER BY l.lida_em DESC)
      FROM public.publicacoes_djen_leituras l
      WHERE l.publicacao_id = c.id AND l.tabela_origem = 'descartada'
    ), '[]'::jsonb),
    c.total_count
  FROM counted c
  ORDER BY c.created_at DESC
  LIMIT GREATEST(p_limit, 1)
  OFFSET GREATEST(p_offset, 0);
END;
$function$;

-- Índices para acelerar filtros das telas de Análise DJEN / Servidor
CREATE INDEX IF NOT EXISTS idx_pub_djen_coord_created ON public.publicacoes_djen (coordenacao_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pub_djen_coord_data_disp ON public.publicacoes_djen (coordenacao_id, data_disponibilizacao DESC);
CREATE INDEX IF NOT EXISTS idx_pub_djen_data_disp ON public.publicacoes_djen (data_disponibilizacao DESC);
CREATE INDEX IF NOT EXISTS idx_pub_djen_tribunal ON public.publicacoes_djen (tribunal);
CREATE INDEX IF NOT EXISTS idx_pub_djen_monitoramento ON public.publicacoes_djen (monitoramento_id);
CREATE INDEX IF NOT EXISTS idx_pub_djen_fonte ON public.publicacoes_djen (fonte);

CREATE INDEX IF NOT EXISTS idx_pub_djen_proc_coord_created ON public.publicacoes_djen_processos (coordenacao_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pub_djen_proc_coord_data_disp ON public.publicacoes_djen_processos (coordenacao_id, data_disponibilizacao DESC);
CREATE INDEX IF NOT EXISTS idx_pub_djen_proc_data_disp ON public.publicacoes_djen_processos (data_disponibilizacao DESC);
CREATE INDEX IF NOT EXISTS idx_pub_djen_proc_tribunal ON public.publicacoes_djen_processos (tribunal);

CREATE INDEX IF NOT EXISTS idx_pub_djen_desc_coord_created ON public.publicacoes_djen_descartadas (coordenacao_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pub_djen_desc_coord_data_disp ON public.publicacoes_djen_descartadas (coordenacao_id, data_disponibilizacao DESC);
CREATE INDEX IF NOT EXISTS idx_pub_djen_desc_processo ON public.publicacoes_djen_descartadas (processo_numero);
CREATE INDEX IF NOT EXISTS idx_pub_djen_desc_processo_digits ON public.publicacoes_djen_descartadas (dedup_processo_digits);
CREATE INDEX IF NOT EXISTS idx_pub_djen_desc_motivo ON public.publicacoes_djen_descartadas (motivo_descarte) WHERE motivo_descarte <> 'termo_nao_encontrado';
CREATE INDEX IF NOT EXISTS idx_pub_djen_desc_monitoramento ON public.publicacoes_djen_descartadas (monitoramento_id);
CREATE INDEX IF NOT EXISTS idx_pub_djen_desc_fonte ON public.publicacoes_djen_descartadas (fonte);

CREATE INDEX IF NOT EXISTS idx_pub_djen_serv_coord_created ON public.publicacoes_djen_servidor (coordenacao_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pub_djen_serv_coord_data_disp ON public.publicacoes_djen_servidor (coordenacao_id, data_disponibilizacao DESC);
CREATE INDEX IF NOT EXISTS idx_pub_djen_serv_data_disp ON public.publicacoes_djen_servidor (data_disponibilizacao DESC);
CREATE INDEX IF NOT EXISTS idx_pub_djen_serv_tribunal ON public.publicacoes_djen_servidor (tribunal);
CREATE INDEX IF NOT EXISTS idx_pub_djen_serv_monitoramento ON public.publicacoes_djen_servidor (monitoramento_id);
