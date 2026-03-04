
DROP FUNCTION IF EXISTS public.get_notificacoes_counts_by_coordenacao(uuid[],date,date,text,text,text);

CREATE FUNCTION public.get_notificacoes_counts_by_coordenacao(
  p_coordenacao_ids uuid[],
  p_periodo_inicio date DEFAULT NULL,
  p_periodo_fim date DEFAULT NULL,
  p_status_filter text DEFAULT NULL,
  p_prioridade_filter text DEFAULT NULL,
  p_search_query text DEFAULT NULL
)
RETURNS TABLE(
  coordenacao_id uuid,
  djen integer,
  distribuicoes integer,
  alertas360 integer,
  redistribuicoes integer,
  andamentos integer,
  prazos integer,
  tarefas integer,
  audiencias integer,
  intimacoes integer,
  proc_nao_cadastrados integer,
  total integer
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid;
  v_d_ini timestamptz;
  v_d_fim timestamptz;
  v_status_filter text;
  v_prioridade_filter text;
  v_q text;
  v_is_pendente boolean;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '28000';
  END IF;

  v_d_ini := CASE WHEN p_periodo_inicio IS NOT NULL 
    THEN (p_periodo_inicio::text || 'T03:00:00Z')::timestamptz 
    ELSE NULL 
  END;
  v_d_fim := CASE WHEN p_periodo_fim IS NOT NULL 
    THEN ((p_periodo_fim + 1)::text || 'T02:59:59.999Z')::timestamptz 
    ELSE NULL 
  END;
  
  v_status_filter := CASE 
    WHEN p_status_filter IS NULL OR btrim(p_status_filter) = '' OR p_status_filter = 'todas' THEN NULL
    ELSE p_status_filter
  END;
  
  v_prioridade_filter := CASE 
    WHEN p_prioridade_filter IS NULL OR btrim(p_prioridade_filter) = '' OR p_prioridade_filter = 'todas' THEN NULL
    ELSE p_prioridade_filter
  END;
  
  v_q := NULLIF(btrim(p_search_query), '');
  v_is_pendente := v_status_filter = 'pendente';

  RETURN QUERY
  WITH
    allowed AS (
      SELECT unnest(COALESCE(p_coordenacao_ids, ARRAY[]::uuid[])) AS cid
      WHERE public.is_admin_or_coordenador(v_uid)
      UNION
      SELECT mc.coordenacao_id AS cid
      FROM membros_coordenacao mc
      WHERE mc.usuario_id = v_uid
        AND mc.coordenacao_id = ANY(COALESCE(p_coordenacao_ids, ARRAY[]::uuid[]))
    ),
    djen_raw AS (
      SELECT
        md.coordenacao_id AS cid,
        regexp_replace(COALESCE(pd.processo_numero, ''), '[^0-9]', '', 'g') AS processo_digits,
        COALESCE(
          to_char(pd.data_publicacao::date, 'YYYY-MM-DD'),
          to_char(pd.data_disponibilizacao::date, 'YYYY-MM-DD'),
          to_char(pd.created_at::date, 'YYYY-MM-DD')
        ) AS data_ref,
        left(lower(regexp_replace(regexp_replace(regexp_replace(
          COALESCE(pd.conteudo, ''), '<[^>]*>', ' ', 'g'
        ), '[^\w\s]', ' ', 'g'), '\s+', ' ', 'g')), 300) AS head_norm
      FROM publicacoes_djen pd
      JOIN monitoramentos_djen md ON md.id = pd.monitoramento_id
      WHERE md.coordenacao_id = ANY(SELECT cid FROM allowed)
        AND (v_d_ini IS NULL OR pd.created_at >= v_d_ini)
        AND (v_d_fim IS NULL OR pd.created_at <= v_d_fim)
        AND (NOT v_is_pendente OR pd.lida = false)
        AND (v_q IS NULL OR pd.conteudo ILIKE ('%' || v_q || '%') OR pd.processo_numero ILIKE ('%' || v_q || '%'))
      
      UNION ALL
      
      SELECT
        p.coordenacao_id AS cid,
        regexp_replace(COALESCE(pdp.processo_numero, ''), '[^0-9]', '', 'g') AS processo_digits,
        COALESCE(
          to_char(pdp.data_publicacao::date, 'YYYY-MM-DD'),
          to_char(pdp.data_disponibilizacao::date, 'YYYY-MM-DD'),
          to_char(pdp.created_at::date, 'YYYY-MM-DD')
        ) AS data_ref,
        left(lower(regexp_replace(regexp_replace(regexp_replace(
          COALESCE(pdp.conteudo, ''), '<[^>]*>', ' ', 'g'
        ), '[^\w\s]', ' ', 'g'), '\s+', ' ', 'g')), 300) AS head_norm
      FROM publicacoes_djen_processos pdp
      JOIN processos p ON p.id = pdp.processo_id
      WHERE p.coordenacao_id = ANY(SELECT cid FROM allowed)
        AND (v_d_ini IS NULL OR pdp.created_at >= v_d_ini)
        AND (v_d_fim IS NULL OR pdp.created_at <= v_d_fim)
        AND (NOT v_is_pendente OR pdp.lida = false)
        AND (v_q IS NULL OR pdp.conteudo ILIKE ('%' || v_q || '%') OR pdp.processo_numero ILIKE ('%' || v_q || '%'))
    ),
    djen_dedup AS (
      SELECT 
        cid,
        COUNT(DISTINCT cid::text || '|' || processo_digits || '|' || data_ref || '|' || head_norm)::int AS cnt
      FROM djen_raw
      GROUP BY cid
    ),
    dist AS (
      SELECT p.coordenacao_id AS cid, COUNT(*)::int AS cnt
      FROM distribuicoes_encontradas de
      JOIN processos p ON p.id = de.processo_id
      WHERE p.coordenacao_id = ANY(SELECT cid FROM allowed)
        AND (v_status_filter IS NULL OR de.status = v_status_filter)
        AND (v_d_ini IS NULL OR de.created_at >= v_d_ini)
        AND (v_d_fim IS NULL OR de.created_at <= v_d_fim)
      GROUP BY p.coordenacao_id
    ),
    al360 AS (
      SELECT p.coordenacao_id AS cid, COUNT(*)::int AS cnt
      FROM alertas_monitoramento am
      JOIN processos p ON p.id = am.processo_id
      WHERE p.coordenacao_id = ANY(SELECT cid FROM allowed)
        AND (v_status_filter IS NULL OR am.status = (CASE WHEN v_status_filter = 'concluido' THEN 'tratado' ELSE v_status_filter END))
        AND (v_d_ini IS NULL OR am.created_at >= v_d_ini)
        AND (v_d_fim IS NULL OR am.created_at <= v_d_fim)
      GROUP BY p.coordenacao_id
    ),
    redist AS (
      SELECT p.coordenacao_id AS cid, COUNT(*)::int AS cnt
      FROM movimentacoes m
      JOIN processos p ON p.id = m.processo_id
      WHERE p.coordenacao_id = ANY(SELECT cid FROM allowed)
        AND m.tipo = 'Redistribuição'
        AND (v_d_ini IS NULL OR m.created_at >= v_d_ini)
        AND (v_d_fim IS NULL OR m.created_at <= v_d_fim)
      GROUP BY p.coordenacao_id
    ),
    and_cnt AS (
      SELECT p.coordenacao_id AS cid, COUNT(*)::int AS cnt
      FROM movimentacoes m
      JOIN processos p ON p.id = m.processo_id
      WHERE p.coordenacao_id = ANY(SELECT cid FROM allowed)
        AND m.tipo <> 'Redistribuição'
        AND (v_d_ini IS NULL OR m.created_at >= v_d_ini)
        AND (v_d_fim IS NULL OR m.created_at <= v_d_fim)
      GROUP BY p.coordenacao_id
    ),
    prazos_cnt AS (
      SELECT p.coordenacao_id AS cid, COUNT(*)::int AS cnt
      FROM tarefas t
      JOIN processos p ON p.id = t.processo_id
      WHERE p.coordenacao_id = ANY(SELECT cid FROM allowed)
        AND t.status = 'pendente'
        AND t.data_vencimento BETWEEN CURRENT_DATE AND (CURRENT_DATE + 5)
        AND (v_prioridade_filter IS NULL OR t.prioridade::text = v_prioridade_filter)
      GROUP BY p.coordenacao_id
    ),
    tar_cnt AS (
      SELECT p.coordenacao_id AS cid, COUNT(*)::int AS cnt
      FROM tarefas t
      JOIN processos p ON p.id = t.processo_id
      WHERE p.coordenacao_id = ANY(SELECT cid FROM allowed)
        AND (v_status_filter IS NULL OR t.status::text = (CASE WHEN v_status_filter = 'concluido' THEN 'cumprido' ELSE v_status_filter END))
        AND (v_d_ini IS NULL OR t.data_vencimento >= v_d_ini::date)
        AND (v_d_fim IS NULL OR t.data_vencimento <= (v_d_fim::date - 1))
        AND (v_prioridade_filter IS NULL OR t.prioridade::text = v_prioridade_filter)
      GROUP BY p.coordenacao_id
    ),
    aud_cnt AS (
      SELECT p.coordenacao_id AS cid, COUNT(*)::int AS cnt
      FROM audiencias_detectadas ad
      JOIN processos p ON p.id = ad.processo_id
      WHERE p.coordenacao_id = ANY(SELECT cid FROM allowed)
        AND (v_status_filter IS NULL OR ad.status = (CASE WHEN v_status_filter = 'concluido' THEN 'tratado' ELSE v_status_filter END))
        AND (v_d_ini IS NULL OR ad.data_audiencia >= v_d_ini::date)
        AND (v_d_fim IS NULL OR ad.data_audiencia <= (v_d_fim::date - 1))
      GROUP BY p.coordenacao_id
    ),
    int_cnt AS (
      SELECT p.coordenacao_id AS cid, COUNT(*)::int AS cnt
      FROM intimacoes_detectadas id
      JOIN processos p ON p.id = id.processo_id
      WHERE p.coordenacao_id = ANY(SELECT cid FROM allowed)
        AND (v_status_filter IS NULL OR id.status = (CASE WHEN v_status_filter = 'concluido' THEN 'tratado' ELSE v_status_filter END))
        AND (v_d_ini IS NULL OR id.data_intimacao >= v_d_ini::date)
        AND (v_d_fim IS NULL OR id.data_intimacao <= (v_d_fim::date - 1))
      GROUP BY p.coordenacao_id
    ),
    pnc_cnt AS (
      SELECT apnc.coordenacao_id AS cid, COUNT(*)::int AS cnt
      FROM alertas_processos_nao_cadastrados apnc
      WHERE apnc.coordenacao_id = ANY(SELECT cid FROM allowed)
        AND (v_status_filter IS NULL OR apnc.status = (CASE WHEN v_status_filter = 'concluido' THEN 'tratado' ELSE v_status_filter END))
        AND (v_d_ini IS NULL OR apnc.created_at >= v_d_ini)
        AND (v_d_fim IS NULL OR apnc.created_at <= v_d_fim)
        AND (v_q IS NULL OR apnc.processo_numero ILIKE ('%' || v_q || '%') OR apnc.termo_encontrado ILIKE ('%' || v_q || '%'))
      GROUP BY apnc.coordenacao_id
    )
  SELECT
    a.cid AS coordenacao_id,
    COALESCE(d.cnt, 0)::int AS djen,
    COALESCE(di.cnt, 0)::int AS distribuicoes,
    COALESCE(al.cnt, 0)::int AS alertas360,
    COALESCE(r.cnt, 0)::int AS redistribuicoes,
    COALESCE(an.cnt, 0)::int AS andamentos,
    COALESCE(pr.cnt, 0)::int AS prazos,
    COALESCE(ta.cnt, 0)::int AS tarefas,
    COALESCE(au.cnt, 0)::int AS audiencias,
    COALESCE(it.cnt, 0)::int AS intimacoes,
    COALESCE(pnc.cnt, 0)::int AS proc_nao_cadastrados,
    (COALESCE(d.cnt,0) + COALESCE(di.cnt,0) + COALESCE(al.cnt,0) + COALESCE(r.cnt,0) + COALESCE(an.cnt,0) + COALESCE(pr.cnt,0) + COALESCE(ta.cnt,0) + COALESCE(au.cnt,0) + COALESCE(it.cnt,0) + COALESCE(pnc.cnt,0))::int AS total
  FROM allowed a
  LEFT JOIN djen_dedup d ON d.cid = a.cid
  LEFT JOIN dist di ON di.cid = a.cid
  LEFT JOIN al360 al ON al.cid = a.cid
  LEFT JOIN redist r ON r.cid = a.cid
  LEFT JOIN and_cnt an ON an.cid = a.cid
  LEFT JOIN prazos_cnt pr ON pr.cid = a.cid
  LEFT JOIN tar_cnt ta ON ta.cid = a.cid
  LEFT JOIN aud_cnt au ON au.cid = a.cid
  LEFT JOIN int_cnt it ON it.cid = a.cid
  LEFT JOIN pnc_cnt pnc ON pnc.cid = a.cid;
END;
$function$;
