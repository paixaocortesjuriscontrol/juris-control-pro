-- Fix enum/text comparison in notification counts RPC (prevents RPC error and zeroed counters)

CREATE OR REPLACE FUNCTION public.get_notificacoes_counts_by_coordenacao(
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
  total integer
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '28000';
  END IF;

  RETURN QUERY
  WITH
    req AS (
      SELECT unnest(COALESCE(p_coordenacao_ids, ARRAY[]::uuid[])) AS coordenacao_id
    ),
    allowed AS (
      SELECT r.coordenacao_id
      FROM req r
      WHERE public.is_admin_or_coordenador(v_uid)
         OR EXISTS (
              SELECT 1
              FROM public.membros_coordenacao mc
              WHERE mc.coordenacao_id = r.coordenacao_id
                AND mc.usuario_id = v_uid
            )
    ),
    params AS (
      SELECT
        p_periodo_inicio AS d_ini,
        p_periodo_fim AS d_fim,
        CASE
          WHEN p_status_filter IS NULL OR btrim(p_status_filter) = '' OR p_status_filter = 'todas' THEN NULL
          ELSE p_status_filter
        END AS status_filter,
        CASE
          WHEN p_prioridade_filter IS NULL OR btrim(p_prioridade_filter) = '' OR p_prioridade_filter = 'todas' THEN NULL
          ELSE p_prioridade_filter
        END AS prioridade_filter,
        NULLIF(btrim(p_search_query), '') AS q
    ),
    dr AS (
      SELECT
        d_ini,
        d_fim,
        CASE WHEN d_fim IS NULL THEN NULL ELSE (d_fim + 1) END AS d_fim_mais_um,
        status_filter,
        prioridade_filter,
        q
      FROM params
    ),
    counts AS (
      SELECT
        a.coordenacao_id,

        -- DJEN: qualquer filtro de status != 'todas' => somente não lidas
        (
          SELECT COUNT(*)::int
          FROM public.publicacoes_djen pd
          JOIN public.monitoramentos_djen md ON md.id = pd.monitoramento_id
          CROSS JOIN dr
          WHERE md.coordenacao_id = a.coordenacao_id
            AND (dr.status_filter IS NULL OR pd.lida = false)
            AND (dr.d_ini IS NULL OR pd.created_at >= dr.d_ini)
            AND (dr.d_fim_mais_um IS NULL OR pd.created_at < dr.d_fim_mais_um)
            AND (
              dr.q IS NULL
              OR pd.conteudo ILIKE ('%' || dr.q || '%')
              OR pd.processo_numero ILIKE ('%' || dr.q || '%')
            )
        ) AS djen,

        -- Distribuições
        (
          SELECT COUNT(*)::int
          FROM public.distribuicoes_encontradas de
          JOIN public.processos p ON p.id = de.processo_id
          CROSS JOIN dr
          WHERE p.coordenacao_id = a.coordenacao_id
            AND (dr.status_filter IS NULL OR de.status = 'pendente')
            AND (dr.d_ini IS NULL OR de.data_distribuicao >= dr.d_ini)
            AND (dr.d_fim IS NULL OR de.data_distribuicao <= dr.d_fim)
            AND (
              dr.q IS NULL
              OR de.numero_processo ILIKE ('%' || dr.q || '%')
              OR COALESCE(de.polo_ativo, '') ILIKE ('%' || dr.q || '%')
              OR COALESCE(de.polo_passivo, '') ILIKE ('%' || dr.q || '%')
            )
        ) AS distribuicoes,

        -- Alertas 360
        (
          SELECT COUNT(*)::int
          FROM public.alertas_monitoramento am
          JOIN public.processos p ON p.id = am.processo_id
          CROSS JOIN dr
          WHERE p.coordenacao_id = a.coordenacao_id
            AND (
              dr.status_filter IS NULL
              OR am.status = (CASE WHEN dr.status_filter = 'concluido' THEN 'tratado' ELSE dr.status_filter END)
            )
            AND (dr.d_ini IS NULL OR am.created_at >= dr.d_ini)
            AND (dr.d_fim_mais_um IS NULL OR am.created_at < dr.d_fim_mais_um)
            AND (
              dr.q IS NULL
              OR am.termo_encontrado ILIKE ('%' || dr.q || '%')
              OR p.numero ILIKE ('%' || dr.q || '%')
            )
        ) AS alertas360,

        -- Redistribuições
        (
          SELECT COUNT(*)::int
          FROM public.movimentacoes m
          JOIN public.processos p ON p.id = m.processo_id
          CROSS JOIN dr
          WHERE p.coordenacao_id = a.coordenacao_id
            AND m.tipo = 'Redistribuição'
            AND (dr.d_ini IS NULL OR m.created_at >= dr.d_ini)
            AND (dr.d_fim_mais_um IS NULL OR m.created_at < dr.d_fim_mais_um)
            AND (
              dr.q IS NULL
              OR COALESCE(m.descricao, '') ILIKE ('%' || dr.q || '%')
              OR COALESCE(m.tipo, '') ILIKE ('%' || dr.q || '%')
              OR p.numero ILIKE ('%' || dr.q || '%')
            )
        ) AS redistribuicoes,

        -- Andamentos
        (
          SELECT COUNT(*)::int
          FROM public.movimentacoes m
          JOIN public.processos p ON p.id = m.processo_id
          CROSS JOIN dr
          WHERE p.coordenacao_id = a.coordenacao_id
            AND m.tipo <> 'Redistribuição'
            AND (dr.d_ini IS NULL OR m.created_at >= dr.d_ini)
            AND (dr.d_fim_mais_um IS NULL OR m.created_at < dr.d_fim_mais_um)
            AND (
              dr.q IS NULL
              OR COALESCE(m.descricao, '') ILIKE ('%' || dr.q || '%')
              OR COALESCE(m.tipo, '') ILIKE ('%' || dr.q || '%')
              OR p.numero ILIKE ('%' || dr.q || '%')
            )
        ) AS andamentos,

        -- Tarefas (enum-safe via ::text)
        (
          SELECT COUNT(*)::int
          FROM public.tarefas t
          JOIN public.processos p ON p.id = t.processo_id
          CROSS JOIN dr
          WHERE p.coordenacao_id = a.coordenacao_id
            AND (
              dr.status_filter IS NULL
              OR t.status::text = (CASE WHEN dr.status_filter = 'concluido' THEN 'cumprido' ELSE dr.status_filter END)
            )
            AND (dr.prioridade_filter IS NULL OR t.prioridade::text = dr.prioridade_filter)
            AND (
              (dr.d_ini IS NULL AND dr.d_fim IS NULL)
              OR t.data_vencimento IS NULL
              OR (
                (dr.d_ini IS NULL OR t.data_vencimento >= dr.d_ini)
                AND (dr.d_fim IS NULL OR t.data_vencimento <= dr.d_fim)
              )
            )
            AND (
              dr.q IS NULL
              OR t.titulo ILIKE ('%' || dr.q || '%')
            )
        ) AS tarefas,

        -- Prazos (enum-safe)
        (
          SELECT COUNT(*)::int
          FROM public.tarefas t
          JOIN public.processos p ON p.id = t.processo_id
          CROSS JOIN dr
          WHERE p.coordenacao_id = a.coordenacao_id
            AND t.status::text = 'pendente'
            AND t.data_vencimento IS NOT NULL
            AND t.data_vencimento <= (CURRENT_DATE + 3)
            AND (dr.d_ini IS NULL OR t.data_vencimento >= dr.d_ini)
            AND (dr.d_fim IS NULL OR t.data_vencimento <= dr.d_fim)
        ) AS prazos,

        -- Audiências
        (
          SELECT COUNT(*)::int
          FROM public.audiencias_detectadas ad
          JOIN public.processos p ON p.id = ad.processo_id
          CROSS JOIN dr
          WHERE p.coordenacao_id = a.coordenacao_id
            AND (
              dr.status_filter IS NULL
              OR ad.status = (CASE WHEN dr.status_filter = 'concluido' THEN 'tratado' ELSE dr.status_filter END)
            )
            AND (dr.d_ini IS NULL OR ad.data_audiencia >= dr.d_ini)
            AND (dr.d_fim IS NULL OR ad.data_audiencia <= dr.d_fim)
            AND (
              dr.q IS NULL
              OR COALESCE(ad.processo_numero, '') ILIKE ('%' || dr.q || '%')
            )
        ) AS audiencias,

        -- Intimações
        (
          SELECT COUNT(*)::int
          FROM public.intimacoes_detectadas id
          JOIN public.processos p ON p.id = id.processo_id
          CROSS JOIN dr
          WHERE p.coordenacao_id = a.coordenacao_id
            AND (
              dr.status_filter IS NULL
              OR id.status = (CASE WHEN dr.status_filter = 'concluido' THEN 'tratado' ELSE dr.status_filter END)
            )
            AND (dr.d_ini IS NULL OR id.data_intimacao >= dr.d_ini)
            AND (dr.d_fim IS NULL OR id.data_intimacao <= dr.d_fim)
            AND (
              dr.q IS NULL
              OR COALESCE(id.processo_numero, '') ILIKE ('%' || dr.q || '%')
              OR COALESCE(id.tipo_intimacao, '') ILIKE ('%' || dr.q || '%')
            )
        ) AS intimacoes

      FROM allowed a
    )
  SELECT
    c.coordenacao_id,
    c.djen,
    c.distribuicoes,
    c.alertas360,
    c.redistribuicoes,
    c.andamentos,
    c.prazos,
    c.tarefas,
    c.audiencias,
    c.intimacoes,
    (c.djen + c.distribuicoes + c.alertas360 + c.redistribuicoes + c.andamentos + c.prazos + c.tarefas + c.audiencias + c.intimacoes)::int AS total
  FROM counts c;

END;
$$;