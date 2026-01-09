
-- Create a function to get client portal statistics without the 1000 limit
CREATE OR REPLACE FUNCTION public.get_cliente_portal_stats(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cliente_ids uuid[];
  v_result jsonb;
  v_total_processos int;
  v_ativos int;
  v_encerrados int;
  v_total_movimentacoes int;
  v_processos_por_status jsonb;
  v_processos_por_area jsonb;
  v_movimentacoes_por_mes jsonb;
  v_audiencias_proximas int;
  v_intimacoes_pendentes int;
BEGIN
  -- Get client IDs linked to this user
  SELECT COALESCE(array_agg(cliente_id), ARRAY[]::uuid[])
  INTO v_cliente_ids
  FROM public.clientes_usuarios
  WHERE user_id = _user_id AND ativo = true;

  IF array_length(v_cliente_ids, 1) IS NULL THEN
    RETURN jsonb_build_object(
      'totalProcessos', 0,
      'ativos', 0,
      'encerrados', 0,
      'totalMovimentacoes', 0,
      'processosPorStatus', '[]'::jsonb,
      'processosPorArea', '[]'::jsonb,
      'movimentacoesPorMes', '[]'::jsonb,
      'audienciasProximas', 0,
      'intimacoesPendentes', 0
    );
  END IF;

  -- Total processes (no limit)
  SELECT 
    COUNT(*)::int,
    COUNT(*) FILTER (WHERE status IN ('ativo', 'urgente', 'pendente'))::int,
    COUNT(*) FILTER (WHERE status IN ('encerrado', 'arquivado'))::int
  INTO v_total_processos, v_ativos, v_encerrados
  FROM public.processos
  WHERE cliente_id = ANY(v_cliente_ids);

  -- Total movements (no limit) 
  SELECT COUNT(*)::int
  INTO v_total_movimentacoes
  FROM public.movimentacoes m
  JOIN public.processos p ON p.id = m.processo_id
  WHERE p.cliente_id = ANY(v_cliente_ids);

  -- Processes by status
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'name', 
        CASE status::text
          WHEN 'ativo' THEN 'Ativo'
          WHEN 'pendente' THEN 'Pendente'
          WHEN 'urgente' THEN 'Urgente'
          WHEN 'encerrado' THEN 'Encerrado'
          WHEN 'arquivado' THEN 'Arquivado'
          ELSE initcap(status::text)
        END,
        'value', total,
        'color',
        CASE status::text
          WHEN 'ativo' THEN '#22C55E'
          WHEN 'pendente' THEN '#EAB308'
          WHEN 'urgente' THEN '#EF4444'
          WHEN 'encerrado' THEN '#6B7280'
          WHEN 'arquivado' THEN '#9CA3AF'
          ELSE '#64748B'
        END
      )
      ORDER BY total DESC
    ),
    '[]'::jsonb
  )
  INTO v_processos_por_status
  FROM (
    SELECT status, COUNT(*)::int as total
    FROM public.processos
    WHERE cliente_id = ANY(v_cliente_ids)
    GROUP BY status
  ) t;

  -- Processes by area
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'name', 
        COALESCE(
          aa.nome,
          CASE p.area
            WHEN 'civil' THEN 'Cível'
            WHEN 'trabalhista' THEN 'Trabalhista'
            WHEN 'empresarial' THEN 'Empresarial'
            ELSE initcap(replace(p.area, '_', ' '))
          END
        ),
        'value', p.total,
        'color', COALESCE(aa.cor, '#64748B')
      )
      ORDER BY p.total DESC
    ),
    '[]'::jsonb
  )
  INTO v_processos_por_area
  FROM (
    SELECT area, COUNT(*)::int as total
    FROM public.processos
    WHERE cliente_id = ANY(v_cliente_ids)
    GROUP BY area
  ) p
  LEFT JOIN public.areas_atuacao aa ON aa.slug = p.area;

  -- Movements per month (last 6 months)
  WITH meses AS (
    SELECT
      date_trunc('month', now()) - (gs || ' months')::interval AS mes_inicio,
      to_char(date_trunc('month', now()) - (gs || ' months')::interval, 'Mon') AS mes
    FROM generate_series(5, 0, -1) gs
  ),
  movs AS (
    SELECT date_trunc('month', m.data_movimentacao) AS mes_inicio, COUNT(*)::int AS total
    FROM public.movimentacoes m
    JOIN public.processos p ON p.id = m.processo_id
    WHERE p.cliente_id = ANY(v_cliente_ids)
    GROUP BY 1
  )
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object('mes', me.mes, 'total', COALESCE(mo.total, 0))
      ORDER BY me.mes_inicio
    ),
    '[]'::jsonb
  )
  INTO v_movimentacoes_por_mes
  FROM meses me
  LEFT JOIN movs mo USING (mes_inicio);

  -- Upcoming hearings (next 30 days)
  SELECT COUNT(*)::int
  INTO v_audiencias_proximas
  FROM public.audiencias_detectadas ad
  WHERE (ad.processo_id IN (SELECT id FROM public.processos WHERE cliente_id = ANY(v_cliente_ids))
    OR ad.processo_numero IN (SELECT numero FROM public.processos WHERE cliente_id = ANY(v_cliente_ids)))
    AND ad.data_audiencia >= CURRENT_DATE
    AND ad.data_audiencia <= CURRENT_DATE + INTERVAL '30 days'
    AND ad.status NOT IN ('cancelada', 'realizada');

  -- Pending summons
  SELECT COUNT(*)::int
  INTO v_intimacoes_pendentes
  FROM public.intimacoes_detectadas id
  WHERE (id.processo_id IN (SELECT id FROM public.processos WHERE cliente_id = ANY(v_cliente_ids))
    OR id.processo_numero IN (SELECT numero FROM public.processos WHERE cliente_id = ANY(v_cliente_ids)))
    AND id.status = 'pendente';

  v_result := jsonb_build_object(
    'totalProcessos', v_total_processos,
    'ativos', v_ativos,
    'encerrados', v_encerrados,
    'totalMovimentacoes', v_total_movimentacoes,
    'processosPorStatus', v_processos_por_status,
    'processosPorArea', v_processos_por_area,
    'movimentacoesPorMes', v_movimentacoes_por_mes,
    'audienciasProximas', v_audiencias_proximas,
    'intimacoesPendentes', v_intimacoes_pendentes
  );

  RETURN v_result;
END;
$$;

-- Create a function to get paginated processes for client portal
CREATE OR REPLACE FUNCTION public.get_cliente_processos_paginados(
  _user_id uuid,
  _page integer DEFAULT 1,
  _page_size integer DEFAULT 50,
  _status text DEFAULT NULL,
  _area text DEFAULT NULL,
  _search text DEFAULT NULL
)
RETURNS TABLE(
  id uuid,
  numero text,
  assunto text,
  area text,
  status text,
  polo_ativo text,
  polo_passivo text,
  tribunal text,
  vara text,
  comarca text,
  data_distribuicao date,
  created_at timestamptz,
  advogado_responsavel jsonb,
  total_count bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cliente_ids uuid[];
  v_total bigint;
  v_offset integer;
BEGIN
  v_offset := GREATEST((_page - 1), 0) * GREATEST(_page_size, 1);

  -- Get client IDs
  SELECT COALESCE(array_agg(cu.cliente_id), ARRAY[]::uuid[])
  INTO v_cliente_ids
  FROM public.clientes_usuarios cu
  WHERE cu.user_id = _user_id AND cu.ativo = true;

  IF array_length(v_cliente_ids, 1) IS NULL THEN
    RETURN;
  END IF;

  -- Count total
  SELECT COUNT(*)
  INTO v_total
  FROM public.processos p
  WHERE p.cliente_id = ANY(v_cliente_ids)
    AND (_status IS NULL OR p.status::text = _status)
    AND (_area IS NULL OR p.area = _area)
    AND (_search IS NULL OR (
      p.numero ILIKE '%' || _search || '%'
      OR COALESCE(p.polo_ativo, '') ILIKE '%' || _search || '%'
      OR COALESCE(p.polo_passivo, '') ILIKE '%' || _search || '%'
      OR COALESCE(p.assunto, '') ILIKE '%' || _search || '%'
    ));

  -- Return paginated results
  RETURN QUERY
  SELECT
    p.id,
    p.numero,
    p.assunto,
    p.area,
    p.status::text,
    p.polo_ativo,
    p.polo_passivo,
    p.tribunal,
    p.vara,
    p.comarca,
    p.data_distribuicao,
    p.created_at,
    jsonb_build_object('id', pr.id, 'nome', pr.nome) AS advogado_responsavel,
    v_total AS total_count
  FROM public.processos p
  LEFT JOIN public.profiles pr ON pr.id = p.advogado_responsavel_id
  WHERE p.cliente_id = ANY(v_cliente_ids)
    AND (_status IS NULL OR p.status::text = _status)
    AND (_area IS NULL OR p.area = _area)
    AND (_search IS NULL OR (
      p.numero ILIKE '%' || _search || '%'
      OR COALESCE(p.polo_ativo, '') ILIKE '%' || _search || '%'
      OR COALESCE(p.polo_passivo, '') ILIKE '%' || _search || '%'
      OR COALESCE(p.assunto, '') ILIKE '%' || _search || '%'
    ))
  ORDER BY p.created_at DESC
  LIMIT _page_size
  OFFSET v_offset;
END;
$$;
