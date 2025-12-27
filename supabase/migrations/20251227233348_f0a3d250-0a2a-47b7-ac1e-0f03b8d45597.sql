-- Drop and recreate get_relatorio_atividades with heavy optimization
CREATE OR REPLACE FUNCTION public.get_relatorio_atividades()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $$
DECLARE
  result jsonb;
  total_prazos int;
  ativ_concluidas int;
  ativ_nao_concluidas int;
  prazos_status jsonb;
  ativ_por_area jsonb;
  evolucao_and jsonb;
  and_por_area jsonb;
  
  -- Pre-aggregated counts
  prazos_cumpridos int;
  prazos_pendentes int;
  prazos_atrasados int;
BEGIN
  -- Simple counts from prazos (very fast, 0 rows currently)
  SELECT 
    COUNT(*)::int,
    COUNT(*) FILTER (WHERE status = 'cumprido')::int,
    COUNT(*) FILTER (WHERE status = 'pendente')::int,
    COUNT(*) FILTER (WHERE status = 'atrasado')::int
  INTO total_prazos, prazos_cumpridos, prazos_pendentes, prazos_atrasados
  FROM public.prazos;
  
  ativ_concluidas := prazos_cumpridos;
  ativ_nao_concluidas := prazos_pendentes + prazos_atrasados;
  
  -- Prazos status (use pre-computed values)
  prazos_status := jsonb_build_array(
    jsonb_build_object('name', 'Cumpridos', 'value', prazos_cumpridos, 'color', '#22C55E'),
    jsonb_build_object('name', 'Pendentes', 'value', prazos_pendentes, 'color', '#EAB308'),
    jsonb_build_object('name', 'Atrasados', 'value', prazos_atrasados, 'color', '#EF4444')
  );
  
  -- Atividades por área - simplified with direct join to processos
  -- Using pre-aggregated subquery for better performance
  WITH area_stats AS (
    SELECT 
      p.area,
      COUNT(*) FILTER (WHERE pr.status = 'cumprido')::int as concluidas,
      COUNT(*) FILTER (WHERE pr.status <> 'cumprido')::int as pendentes
    FROM public.prazos pr
    JOIN public.processos p ON p.id = pr.processo_id
    GROUP BY p.area
  )
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'name', 
        CASE area 
          WHEN 'civil' THEN 'Cível' 
          WHEN 'trabalhista' THEN 'Trabalhista' 
          WHEN 'empresarial' THEN 'Empresarial'
          ELSE 'Outros'
        END,
        'concluidas', concluidas,
        'pendentes', pendentes
      )
    ),
    '[]'::jsonb
  )
  INTO ativ_por_area
  FROM area_stats;
  
  -- Evolução andamentos por ano - use index on data_movimentacao
  SELECT COALESCE(
    jsonb_agg(jsonb_build_object('ano', ano::text, 'total', total) ORDER BY ano),
    '[]'::jsonb
  )
  INTO evolucao_and
  FROM (
    SELECT 
      EXTRACT(YEAR FROM data_movimentacao)::int as ano, 
      COUNT(*)::int as total
    FROM public.movimentacoes
    WHERE data_movimentacao >= '2000-01-01' -- Filter out bad dates
      AND data_movimentacao <= now() + interval '1 year'
    GROUP BY 1
    ORDER BY 1
  ) t;
  
  -- Andamentos por área - use a materialized aggregation approach
  WITH mov_area AS (
    SELECT p.area, COUNT(*)::int as total
    FROM public.movimentacoes m
    JOIN public.processos p ON p.id = m.processo_id
    GROUP BY p.area
  )
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'name', 
        CASE area 
          WHEN 'civil' THEN 'Cível' 
          WHEN 'trabalhista' THEN 'Trabalhista' 
          WHEN 'empresarial' THEN 'Empresarial'
          ELSE 'Outros'
        END,
        'value', total,
        'color',
        CASE area 
          WHEN 'civil' THEN '#3B82F6' 
          WHEN 'trabalhista' THEN '#22C55E' 
          WHEN 'empresarial' THEN '#8B5CF6'
          ELSE '#94A3B8'
        END
      )
      ORDER BY total DESC
    ),
    '[]'::jsonb
  )
  INTO and_por_area
  FROM mov_area;
  
  result := jsonb_build_object(
    'totalPrazos', total_prazos,
    'prazosStatus', prazos_status,
    'atividadesConcluidas', ativ_concluidas,
    'atividadesNaoConcluidas', ativ_nao_concluidas,
    'atividadesPorArea', COALESCE(ativ_por_area, '[]'::jsonb),
    'evolucaoAndamentos', evolucao_and,
    'andamentosPorArea', and_por_area
  );
  
  RETURN result;
END;
$$;