
-- Dropar e recriar a função com contagem otimizada (remove deduplicação complexa que causa lentidão)
DROP FUNCTION IF EXISTS public.get_notificacoes_counts_by_coordenacao(uuid[], date, date, text, text, text);

CREATE FUNCTION public.get_notificacoes_counts_by_coordenacao(
  p_coordenacao_ids uuid[],
  p_periodo_inicio date DEFAULT NULL,
  p_periodo_fim date DEFAULT NULL,
  p_status_filter text DEFAULT NULL,
  p_prioridade_filter text DEFAULT NULL,
  p_search_query text DEFAULT NULL
)
RETURNS TABLE (
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
  total integer
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_d_ini date;
  v_d_fim date;
  v_d_fim_plus date;
  v_status_filter text;
  v_prioridade_filter text;
  v_q text;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '28000';
  END IF;

  -- Parse parameters
  v_d_ini := p_periodo_inicio;
  v_d_fim := p_periodo_fim;
  v_d_fim_plus := CASE WHEN v_d_fim IS NOT NULL THEN v_d_fim + 1 ELSE NULL END;
  
  v_status_filter := CASE 
    WHEN p_status_filter IS NULL OR btrim(p_status_filter) = '' OR p_status_filter = 'todas' THEN NULL
    ELSE p_status_filter
  END;
  
  v_prioridade_filter := CASE 
    WHEN p_prioridade_filter IS NULL OR btrim(p_prioridade_filter) = '' OR p_prioridade_filter = 'todas' THEN NULL
    ELSE p_prioridade_filter
  END;
  
  v_q := NULLIF(btrim(p_search_query), '');

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
    -- DJEN: contagem SIMPLES (sem deduplicação complexa - performance)
    djen_termos AS (
      SELECT md.coordenacao_id AS cid, COUNT(*)::int AS cnt
      FROM publicacoes_djen pd
      JOIN monitoramentos_djen md ON md.id = pd.monitoramento_id
      WHERE md.coordenacao_id = ANY(SELECT cid FROM allowed)
        AND (v_status_filter IS NULL OR (v_status_filter = 'pendente' AND pd.lida = false) OR (v_status_filter = 'concluido' AND pd.lida = true))
        AND (v_d_ini IS NULL OR pd.created_at >= v_d_ini)
        AND (v_d_fim_plus IS NULL OR pd.created_at < v_d_fim_plus)
        AND (v_q IS NULL OR pd.conteudo ILIKE ('%' || v_q || '%') OR pd.processo_numero ILIKE ('%' || v_q || '%'))
      GROUP BY md.coordenacao_id
    ),
    djen_processos AS (
      SELECT p.coordenacao_id AS cid, COUNT(*)::int AS cnt
      FROM publicacoes_djen_processos pdp
      JOIN processos p ON p.id = pdp.processo_id
      WHERE p.coordenacao_id = ANY(SELECT cid FROM allowed)
        AND (v_status_filter IS NULL OR (v_status_filter = 'pendente' AND pdp.lida = false) OR (v_status_filter = 'concluido' AND pdp.lida = true))
        AND (v_d_ini IS NULL OR pdp.created_at >= v_d_ini)
        AND (v_d_fim_plus IS NULL OR pdp.created_at < v_d_fim_plus)
        AND (v_q IS NULL OR pdp.conteudo ILIKE ('%' || v_q || '%') OR pdp.processo_numero ILIKE ('%' || v_q || '%'))
      GROUP BY p.coordenacao_id
    ),
    -- Distribuições
    dist AS (
      SELECT p.coordenacao_id AS cid, COUNT(*)::int AS cnt
      FROM distribuicoes_encontradas de
      JOIN processos p ON p.id = de.processo_id
      WHERE p.coordenacao_id = ANY(SELECT cid FROM allowed)
        AND (v_status_filter IS NULL OR de.status = v_status_filter)
        AND (v_d_ini IS NULL OR de.created_at >= v_d_ini)
        AND (v_d_fim_plus IS NULL OR de.created_at < v_d_fim_plus)
      GROUP BY p.coordenacao_id
    ),
    -- Alertas 360
    al360 AS (
      SELECT p.coordenacao_id AS cid, COUNT(*)::int AS cnt
      FROM alertas_monitoramento am
      JOIN processos p ON p.id = am.processo_id
      WHERE p.coordenacao_id = ANY(SELECT cid FROM allowed)
        AND (v_status_filter IS NULL OR am.status = (CASE WHEN v_status_filter = 'concluido' THEN 'tratado' ELSE v_status_filter END))
        AND (v_d_ini IS NULL OR am.created_at >= v_d_ini)
        AND (v_d_fim_plus IS NULL OR am.created_at < v_d_fim_plus)
      GROUP BY p.coordenacao_id
    ),
    -- Redistribuições
    redist AS (
      SELECT p.coordenacao_id AS cid, COUNT(*)::int AS cnt
      FROM movimentacoes m
      JOIN processos p ON p.id = m.processo_id
      WHERE p.coordenacao_id = ANY(SELECT cid FROM allowed)
        AND m.tipo = 'Redistribuição'
        AND (v_d_ini IS NULL OR m.created_at >= v_d_ini)
        AND (v_d_fim_plus IS NULL OR m.created_at < v_d_fim_plus)
      GROUP BY p.coordenacao_id
    ),
    -- Andamentos (exceto redistribuições)
    and_cnt AS (
      SELECT p.coordenacao_id AS cid, COUNT(*)::int AS cnt
      FROM movimentacoes m
      JOIN processos p ON p.id = m.processo_id
      WHERE p.coordenacao_id = ANY(SELECT cid FROM allowed)
        AND m.tipo <> 'Redistribuição'
        AND (v_d_ini IS NULL OR m.created_at >= v_d_ini)
        AND (v_d_fim_plus IS NULL OR m.created_at < v_d_fim_plus)
      GROUP BY p.coordenacao_id
    ),
    -- Prazos (hoje + 5 dias)
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
    -- Tarefas
    tar_cnt AS (
      SELECT p.coordenacao_id AS cid, COUNT(*)::int AS cnt
      FROM tarefas t
      JOIN processos p ON p.id = t.processo_id
      WHERE p.coordenacao_id = ANY(SELECT cid FROM allowed)
        AND (v_status_filter IS NULL OR t.status::text = (CASE WHEN v_status_filter = 'concluido' THEN 'cumprido' ELSE v_status_filter END))
        AND (v_d_ini IS NULL OR t.data_vencimento >= v_d_ini)
        AND (v_d_fim IS NULL OR t.data_vencimento <= v_d_fim)
        AND (v_prioridade_filter IS NULL OR t.prioridade::text = v_prioridade_filter)
      GROUP BY p.coordenacao_id
    ),
    -- Audiências
    aud_cnt AS (
      SELECT p.coordenacao_id AS cid, COUNT(*)::int AS cnt
      FROM audiencias_detectadas ad
      JOIN processos p ON p.id = ad.processo_id
      WHERE p.coordenacao_id = ANY(SELECT cid FROM allowed)
        AND (v_status_filter IS NULL OR ad.status = (CASE WHEN v_status_filter = 'concluido' THEN 'tratado' ELSE v_status_filter END))
        AND (v_d_ini IS NULL OR ad.data_audiencia >= v_d_ini)
        AND (v_d_fim IS NULL OR ad.data_audiencia <= v_d_fim)
      GROUP BY p.coordenacao_id
    ),
    -- Intimações
    int_cnt AS (
      SELECT p.coordenacao_id AS cid, COUNT(*)::int AS cnt
      FROM intimacoes_detectadas id
      JOIN processos p ON p.id = id.processo_id
      WHERE p.coordenacao_id = ANY(SELECT cid FROM allowed)
        AND (v_status_filter IS NULL OR id.status = (CASE WHEN v_status_filter = 'concluido' THEN 'tratado' ELSE v_status_filter END))
        AND (v_d_ini IS NULL OR id.data_intimacao >= v_d_ini)
        AND (v_d_fim IS NULL OR id.data_intimacao <= v_d_fim)
      GROUP BY p.coordenacao_id
    )
  SELECT
    a.cid AS coordenacao_id,
    (COALESCE(dt.cnt, 0) + COALESCE(dp.cnt, 0))::int AS djen,
    COALESCE(d.cnt, 0)::int AS distribuicoes,
    COALESCE(al.cnt, 0)::int AS alertas360,
    COALESCE(r.cnt, 0)::int AS redistribuicoes,
    COALESCE(ac.cnt, 0)::int AS andamentos,
    COALESCE(pr.cnt, 0)::int AS prazos,
    COALESCE(t.cnt, 0)::int AS tarefas,
    COALESCE(au.cnt, 0)::int AS audiencias,
    COALESCE(ic.cnt, 0)::int AS intimacoes,
    (COALESCE(dt.cnt, 0) + COALESCE(dp.cnt, 0) + COALESCE(d.cnt, 0) + COALESCE(al.cnt, 0) + COALESCE(r.cnt, 0) + COALESCE(ac.cnt, 0) + COALESCE(pr.cnt, 0) + COALESCE(t.cnt, 0) + COALESCE(au.cnt, 0) + COALESCE(ic.cnt, 0))::int AS total
  FROM allowed a
  LEFT JOIN djen_termos dt ON dt.cid = a.cid
  LEFT JOIN djen_processos dp ON dp.cid = a.cid
  LEFT JOIN dist d ON d.cid = a.cid
  LEFT JOIN al360 al ON al.cid = a.cid
  LEFT JOIN redist r ON r.cid = a.cid
  LEFT JOIN and_cnt ac ON ac.cid = a.cid
  LEFT JOIN prazos_cnt pr ON pr.cid = a.cid
  LEFT JOIN tar_cnt t ON t.cid = a.cid
  LEFT JOIN aud_cnt au ON au.cid = a.cid
  LEFT JOIN int_cnt ic ON ic.cid = a.cid;
END;
$$;
