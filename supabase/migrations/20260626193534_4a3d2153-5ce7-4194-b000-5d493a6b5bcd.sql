-- Regra definitiva DJEN: deduplicação somente por coordenacao_id + id_djen.
-- Conteúdo, processo, data, hash_conteudo e dedup_conteudo_key não podem
-- colapsar comunicações oficiais diferentes.

DROP INDEX IF EXISTS public.idx_publicacoes_djen_hash;
DROP INDEX IF EXISTS public.uq_pub_djen_servidor_hash;
DROP INDEX IF EXISTS public.idx_pub_djen_servidor_conteudo_key;
DROP INDEX IF EXISTS public.uq_pub_djen_servidor_coord_conteudo_key;

WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (
    PARTITION BY coordenacao_id, id_djen
    ORDER BY created_at ASC, id ASC
  ) rn
  FROM public.publicacoes_djen
  WHERE id_djen IS NOT NULL AND coordenacao_id IS NOT NULL
)
DELETE FROM public.publicacoes_djen p
USING ranked r
WHERE p.id = r.id AND r.rn > 1;

WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (
    PARTITION BY coordenacao_id, id_djen
    ORDER BY created_at ASC, id ASC
  ) rn
  FROM public.publicacoes_djen_servidor
  WHERE id_djen IS NOT NULL AND coordenacao_id IS NOT NULL
)
DELETE FROM public.publicacoes_djen_servidor p
USING ranked r
WHERE p.id = r.id AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS uq_pub_djen_coord_iddjen
  ON public.publicacoes_djen (coordenacao_id, id_djen)
  WHERE id_djen IS NOT NULL AND coordenacao_id IS NOT NULL;

DROP INDEX IF EXISTS public.uq_pub_djen_servidor_coord_id_djen;
CREATE UNIQUE INDEX uq_pub_djen_servidor_coord_id_djen
  ON public.publicacoes_djen_servidor (coordenacao_id, id_djen)
  WHERE id_djen IS NOT NULL AND coordenacao_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.get_djen_publicacoes_unificadas(
  p_coordenacao_id uuid DEFAULT NULL::uuid,
  p_inicio timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_fim timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_apenas_nao_lidas boolean DEFAULT false,
  p_search_query text DEFAULT NULL::text,
  p_limit integer DEFAULT 500,
  p_offset integer DEFAULT 0,
  p_monitoramento_id uuid DEFAULT NULL::uuid,
  p_tipo_origem text DEFAULT NULL::text,
  p_read_status text DEFAULT 'todas'::text,
  p_data_disponibilizacao_inicio timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_data_disponibilizacao_fim timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_tribunal text DEFAULT NULL::text,
  p_dedup boolean DEFAULT false
)
RETURNS TABLE(
  id uuid,
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
AS $function$
DECLARE
  v_uid uuid;
  v_q text;
  v_q_digits text;
  v_tipo text;
  v_read text;
  v_is_admin boolean;
  v_tribunal text;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not authenticated' USING ERRCODE = '28000'; END IF;
  v_is_admin := public.is_admin_or_coordenador(v_uid);
  IF p_coordenacao_id IS NOT NULL AND NOT v_is_admin
     AND NOT EXISTS (SELECT 1 FROM public.membros_coordenacao mc WHERE mc.coordenacao_id = p_coordenacao_id AND mc.usuario_id = v_uid)
  THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  v_tipo := NULLIF(btrim(COALESCE(p_tipo_origem, '')), '');
  IF v_tipo = 'todos' THEN v_tipo := NULL; END IF;
  v_read := COALESCE(NULLIF(btrim(p_read_status), ''), 'todas');
  v_q := NULLIF(btrim(p_search_query), '');
  v_q_digits := CASE WHEN v_q IS NOT NULL THEN regexp_replace(v_q, '[^0-9]', '', 'g') ELSE NULL END;
  IF v_q_digits IS NOT NULL AND length(v_q_digits) < 5 THEN v_q_digits := NULL; END IF;
  v_tribunal := NULLIF(regexp_replace(upper(COALESCE(p_tribunal, '')), '[^A-Z0-9]', '', 'g'), '');

  RETURN QUERY
  WITH base AS (
    SELECT pd.id, 'termo'::text AS tipo_origem, NULL::uuid AS processo_id,
      pd.processo_numero, pd.conteudo, pd.data_publicacao, pd.data_disponibilizacao,
      pd.fonte, pd.lida, pd.created_at, pd.monitoramento_id,
      md.termo_busca AS monitoramento_termo, md.descricao AS monitoramento_descricao,
      md.tipo AS monitoramento_tipo, md.oab AS monitoramento_oab, md.uf AS monitoramento_uf,
      COALESCE(pd.coordenacao_id, md.coordenacao_id) AS coordenacao_id,
      c.nome AS coordenacao_nome,
      pd.polo_ativo, pd.polo_passivo, pd.tribunal, pd.orgao, pd.tipo_comunicacao, pd.meio,
      pd.advogados_json, pd.partes_json,
      COALESCE(pd.coordenacao_id, md.coordenacao_id) AS dedup_coord,
      CASE
        WHEN NULLIF(btrim(pd.id_djen), '') IS NOT NULL THEN 'id_djen|' || btrim(pd.id_djen)
        ELSE 'row|termo|' || pd.id::text
      END AS dedup_uid,
      CASE WHEN md.tipo = 'parte' THEN 0 ELSE 1 END AS prio,
      CASE WHEN pd.status = 'encontrada' THEN 0 ELSE 1 END AS status_prio
    FROM public.publicacoes_djen pd
    JOIN public.monitoramentos_djen md ON md.id = pd.monitoramento_id
    LEFT JOIN public.coordenacoes c ON c.id = COALESCE(pd.coordenacao_id, md.coordenacao_id)
    WHERE (
        p_coordenacao_id IS NULL
        OR pd.coordenacao_id = p_coordenacao_id
        OR (pd.coordenacao_id IS NULL AND md.coordenacao_id = p_coordenacao_id)
      )
      AND (v_is_admin OR EXISTS (SELECT 1 FROM public.membros_coordenacao mc WHERE mc.coordenacao_id = COALESCE(pd.coordenacao_id, md.coordenacao_id) AND mc.usuario_id = v_uid))
      AND pd.status IN ('encontrada','duplicada')
      AND (v_tipo IS NULL OR v_tipo IN ('termo','parte'))
      AND (v_tipo IS DISTINCT FROM 'parte' OR md.tipo = 'parte')
      AND COALESCE(pd.fonte, '') <> 'dejt-pdf'
      AND (p_monitoramento_id IS NULL OR pd.monitoramento_id = p_monitoramento_id)
      AND (
        p_inicio IS NULL
        OR (lower(COALESCE(pd.fonte, '')) <> 'kurier' AND pd.created_at >= p_inicio)
        OR (lower(COALESCE(pd.fonte, '')) = 'kurier' AND COALESCE(pd.data_publicacao, pd.created_at) >= p_inicio)
      )
      AND (
        p_fim IS NULL
        OR (lower(COALESCE(pd.fonte, '')) <> 'kurier' AND pd.created_at <= p_fim)
        OR (lower(COALESCE(pd.fonte, '')) = 'kurier' AND COALESCE(pd.data_publicacao, pd.created_at) <= p_fim)
      )
      AND (p_data_disponibilizacao_inicio IS NULL OR pd.data_disponibilizacao >= p_data_disponibilizacao_inicio)
      AND (p_data_disponibilizacao_fim IS NULL OR pd.data_disponibilizacao <= p_data_disponibilizacao_fim)
      AND (v_tribunal IS NULL OR upper(COALESCE(pd.tribunal, pd.fonte, '')) ~ ('(^|[^A-Z0-9])' || v_tribunal || '([^A-Z0-9]|$)'))
      AND (NOT p_apenas_nao_lidas OR pd.lida = false)
      AND (v_q IS NULL OR pd.conteudo ILIKE ('%'||v_q||'%') OR pd.processo_numero ILIKE ('%'||v_q||'%') OR md.termo_busca ILIKE ('%'||v_q||'%')
           OR (v_q_digits IS NOT NULL AND regexp_replace(COALESCE(pd.processo_numero,''),'[^0-9]','','g') LIKE ('%'||v_q_digits||'%')))
    UNION ALL
    SELECT pdp.id, 'processo'::text, pdp.processo_id, pdp.processo_numero, pdp.conteudo,
      pdp.data_publicacao, pdp.data_disponibilizacao, pdp.fonte, pdp.lida, pdp.created_at,
      NULL::uuid, NULL::text, NULL::text, NULL::text, NULL::text, NULL::text,
      pdp.coordenacao_id, c2.nome,
      p.polo_ativo, p.polo_passivo, pdp.tribunal, pdp.orgao, pdp.tipo_comunicacao, pdp.meio,
      pdp.advogados_json, pdp.partes_json,
      pdp.coordenacao_id,
      CASE
        WHEN NULLIF(btrim(pdp.id_djen), '') IS NOT NULL THEN 'id_djen|' || btrim(pdp.id_djen)
        ELSE 'row|processo|' || pdp.id::text
      END,
      2, CASE WHEN pdp.status = 'encontrada' THEN 0 ELSE 1 END
    FROM public.publicacoes_djen_processos pdp
    JOIN public.processos p ON p.id = pdp.processo_id
    JOIN public.coordenacoes c2 ON c2.id = pdp.coordenacao_id
    WHERE (p_coordenacao_id IS NULL OR pdp.coordenacao_id = p_coordenacao_id)
      AND (v_is_admin OR EXISTS (SELECT 1 FROM public.membros_coordenacao mc WHERE mc.coordenacao_id = pdp.coordenacao_id AND mc.usuario_id = v_uid))
      AND pdp.status IN ('encontrada','duplicada')
      AND (v_tipo IS NULL OR v_tipo = 'processo')
      AND p_monitoramento_id IS NULL
      AND (
        p_inicio IS NULL
        OR (lower(COALESCE(pdp.fonte, '')) <> 'kurier' AND pdp.created_at >= p_inicio)
        OR (lower(COALESCE(pdp.fonte, '')) = 'kurier' AND COALESCE(pdp.data_publicacao, pdp.created_at) >= p_inicio)
      )
      AND (
        p_fim IS NULL
        OR (lower(COALESCE(pdp.fonte, '')) <> 'kurier' AND pdp.created_at <= p_fim)
        OR (lower(COALESCE(pdp.fonte, '')) = 'kurier' AND COALESCE(pdp.data_publicacao, pdp.created_at) <= p_fim)
      )
      AND (p_data_disponibilizacao_inicio IS NULL OR pdp.data_disponibilizacao >= p_data_disponibilizacao_inicio)
      AND (p_data_disponibilizacao_fim IS NULL OR pdp.data_disponibilizacao <= p_data_disponibilizacao_fim)
      AND (v_tribunal IS NULL OR upper(COALESCE(pdp.tribunal, pdp.fonte, '')) ~ ('(^|[^A-Z0-9])' || v_tribunal || '([^A-Z0-9]|$)'))
      AND (NOT p_apenas_nao_lidas OR pdp.lida = false)
      AND (v_q IS NULL OR pdp.conteudo ILIKE ('%'||v_q||'%') OR pdp.processo_numero ILIKE ('%'||v_q||'%')
           OR COALESCE(p.polo_ativo,'') ILIKE ('%'||v_q||'%') OR COALESCE(p.polo_passivo,'') ILIKE ('%'||v_q||'%')
           OR (v_q_digits IS NOT NULL AND regexp_replace(COALESCE(pdp.processo_numero,''),'[^0-9]','','g') LIKE ('%'||v_q_digits||'%')))
  ),
  ranked AS (
    SELECT DISTINCT ON (b.dedup_coord, b.dedup_uid) b.*
    FROM base b
    WHERE p_dedup = true
    ORDER BY b.dedup_coord, b.dedup_uid, b.status_prio, b.prio, b.created_at ASC, b.id ASC
  ),
  all_rows AS (
    SELECT b.* FROM base b WHERE p_dedup = false
    UNION ALL
    SELECT r.* FROM ranked r
  ),
  filtered AS (
    SELECT a.*, EXISTS (SELECT 1 FROM public.publicacoes_djen_leituras l WHERE l.publicacao_id=a.id AND l.tabela_origem=a.tipo_origem AND l.usuario_id=v_uid) AS lida_por_user
    FROM all_rows a
  ),
  final_rows AS (
    SELECT f.* FROM filtered f
    WHERE v_read='todas' OR (v_read='nao_lidas' AND NOT f.lida_por_user) OR (v_read='lidas' AND f.lida_por_user)
    ORDER BY f.created_at DESC LIMIT GREATEST(p_limit,1) OFFSET GREATEST(p_offset,0)
  )
  SELECT f.id, f.tipo_origem, f.processo_id, f.processo_numero, f.conteudo,
    f.data_publicacao, f.data_disponibilizacao, f.fonte, f.lida_por_user, f.created_at,
    f.monitoramento_id, f.monitoramento_termo, f.monitoramento_descricao, f.monitoramento_tipo,
    f.monitoramento_oab, f.monitoramento_uf, f.coordenacao_id, f.coordenacao_nome,
    f.polo_ativo, f.polo_passivo, f.tribunal, f.orgao, f.tipo_comunicacao, f.meio,
    f.advogados_json, f.partes_json,
    COALESCE((SELECT jsonb_agg(jsonb_build_object('nome',COALESCE(l.usuario_nome,'Desconhecido'),'lida_em',l.lida_em) ORDER BY l.lida_em DESC)
              FROM public.publicacoes_djen_leituras l WHERE l.publicacao_id=f.id AND l.tabela_origem=f.tipo_origem),'[]'::jsonb)
  FROM final_rows f ORDER BY f.created_at DESC;
END;
$function$;

CREATE OR REPLACE FUNCTION public.descartar_duplicadas_coordenacao(
  p_coordenacao_id uuid,
  p_data_disp_inicio date DEFAULT NULL,
  p_data_disp_fim date DEFAULT NULL
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
        PARTITION BY COALESCE(pd.coordenacao_id, md.coordenacao_id), pd.id_djen
        ORDER BY
          CASE WHEN pd.status = 'encontrada' THEN 0 ELSE 1 END,
          CASE WHEN md.tipo = 'parte' THEN 0 ELSE 1 END,
          pd.created_at ASC,
          pd.id ASC
      ) AS rn
    FROM public.publicacoes_djen pd
    JOIN public.monitoramentos_djen md ON md.id = pd.monitoramento_id
    WHERE COALESCE(pd.coordenacao_id, md.coordenacao_id) = p_coordenacao_id
      AND pd.id_djen IS NOT NULL
      AND pd.status IN ('encontrada','duplicada')
      AND (
        p_data_disp_inicio IS NULL
        OR pd.data_disponibilizacao::date >= p_data_disp_inicio
        OR pd.data_publicacao::date       >= p_data_disp_inicio
      )
      AND (
        p_data_disp_fim IS NULL
        OR pd.data_disponibilizacao::date <= p_data_disp_fim
        OR pd.data_publicacao::date       <= p_data_disp_fim
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
    p.conteudo, p.fonte, 'duplicada_id_djen', p.data_disponibilizacao, p.tribunal,
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
        PARTITION BY pdp.coordenacao_id, pdp.id_djen
        ORDER BY
          CASE WHEN pdp.status = 'encontrada' THEN 0 ELSE 1 END,
          pdp.created_at ASC,
          pdp.id ASC
      ) AS rn
    FROM public.publicacoes_djen_processos pdp
    WHERE pdp.coordenacao_id = p_coordenacao_id
      AND pdp.id_djen IS NOT NULL
      AND pdp.status IN ('encontrada','duplicada')
      AND (
        p_data_disp_inicio IS NULL
        OR pdp.data_disponibilizacao::date >= p_data_disp_inicio
        OR pdp.data_publicacao::date       >= p_data_disp_inicio
      )
      AND (
        p_data_disp_fim IS NULL
        OR pdp.data_disponibilizacao::date <= p_data_disp_fim
        OR pdp.data_publicacao::date       <= p_data_disp_fim
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
    p.conteudo, p.fonte, 'duplicada_id_djen', p.data_disponibilizacao, p.tribunal,
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
    'regra', 'coordenacao_id+id_djen'
  );
END;
$function$;