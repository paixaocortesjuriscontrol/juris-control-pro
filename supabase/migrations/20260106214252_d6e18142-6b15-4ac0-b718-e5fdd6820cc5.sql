-- Criar função para relatório de Prazos (mais leve)
CREATE OR REPLACE FUNCTION public.get_relatorio_prazos()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
  total_tarefas int;
  tarefas_cumpridas int;
  tarefas_pendentes int;
  tarefas_atrasadas int;
  tarefas_status jsonb;
BEGIN
  -- Contagem rápida de status de tarefas
  SELECT 
    COUNT(*)::int,
    COUNT(*) FILTER (WHERE status = 'cumprido')::int,
    COUNT(*) FILTER (WHERE status = 'pendente')::int,
    COUNT(*) FILTER (WHERE status = 'atrasado')::int
  INTO total_tarefas, tarefas_cumpridas, tarefas_pendentes, tarefas_atrasadas
  FROM public.tarefas;
  
  tarefas_status := jsonb_build_array(
    jsonb_build_object('name', 'Cumpridas', 'value', tarefas_cumpridas, 'color', '#22C55E'),
    jsonb_build_object('name', 'Pendentes', 'value', tarefas_pendentes, 'color', '#EAB308'),
    jsonb_build_object('name', 'Atrasadas', 'value', tarefas_atrasadas, 'color', '#EF4444')
  );
  
  result := jsonb_build_object(
    'totalPrazos', total_tarefas,
    'prazosStatus', tarefas_status,
    'prazosCumpridos', tarefas_cumpridas,
    'prazosPendentes', tarefas_pendentes,
    'prazosAtrasados', tarefas_atrasadas
  );
  
  RETURN result;
END;
$$;

-- Criar função para relatório de Tarefas por Área (mais leve)
CREATE OR REPLACE FUNCTION public.get_relatorio_tarefas()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
  ativ_por_area jsonb;
  total_concluidas int;
  total_pendentes int;
BEGIN
  -- Atividades por área com JOIN simples
  WITH area_stats AS (
    SELECT 
      COALESCE(p.area, 'outros') as area,
      COUNT(*) FILTER (WHERE t.status = 'cumprido')::int as concluidas,
      COUNT(*) FILTER (WHERE t.status <> 'cumprido')::int as pendentes
    FROM public.tarefas t
    LEFT JOIN public.processos p ON p.id = t.processo_id
    GROUP BY COALESCE(p.area, 'outros')
  )
  SELECT 
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'name', 
          CASE area 
            WHEN 'civil' THEN 'Cível' 
            WHEN 'trabalhista' THEN 'Trabalhista' 
            WHEN 'empresarial' THEN 'Empresarial'
            WHEN 'tributario' THEN 'Tributário'
            WHEN 'previdenciario' THEN 'Previdenciário'
            ELSE 'Outros'
          END,
          'concluidas', concluidas,
          'pendentes', pendentes
        )
        ORDER BY (concluidas + pendentes) DESC
      ),
      '[]'::jsonb
    ),
    COALESCE(SUM(concluidas), 0)::int,
    COALESCE(SUM(pendentes), 0)::int
  INTO ativ_por_area, total_concluidas, total_pendentes
  FROM area_stats;
  
  result := jsonb_build_object(
    'atividadesPorArea', ativ_por_area,
    'totalConcluidas', total_concluidas,
    'totalPendentes', total_pendentes
  );
  
  RETURN result;
END;
$$;

-- Criar função para relatório de Andamentos (mais leve)
CREATE OR REPLACE FUNCTION public.get_relatorio_andamentos()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
  evolucao_and jsonb;
  and_por_area jsonb;
  total_andamentos int;
BEGIN
  -- Total de andamentos
  SELECT COUNT(*)::int INTO total_andamentos FROM public.movimentacoes;

  -- Evolução por ano (limitado aos últimos 10 anos para performance)
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
    WHERE data_movimentacao >= (now() - interval '10 years')
      AND data_movimentacao <= now()
    GROUP BY 1
    ORDER BY 1
  ) t;
  
  -- Andamentos por área
  WITH mov_area AS (
    SELECT COALESCE(p.area, 'outros') as area, COUNT(*)::int as total
    FROM public.movimentacoes m
    LEFT JOIN public.processos p ON p.id = m.processo_id
    GROUP BY COALESCE(p.area, 'outros')
  )
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'name', 
        CASE area 
          WHEN 'civil' THEN 'Cível' 
          WHEN 'trabalhista' THEN 'Trabalhista' 
          WHEN 'empresarial' THEN 'Empresarial'
          WHEN 'tributario' THEN 'Tributário'
          WHEN 'previdenciario' THEN 'Previdenciário'
          ELSE 'Outros'
        END,
        'value', total,
        'color',
        CASE area 
          WHEN 'civil' THEN '#3B82F6' 
          WHEN 'trabalhista' THEN '#22C55E' 
          WHEN 'empresarial' THEN '#8B5CF6'
          WHEN 'tributario' THEN '#F59E0B'
          WHEN 'previdenciario' THEN '#EC4899'
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
    'totalAndamentos', total_andamentos,
    'evolucaoAndamentos', evolucao_and,
    'andamentosPorArea', and_por_area
  );
  
  RETURN result;
END;
$$;

-- Criar índices para melhorar performance das queries
CREATE INDEX IF NOT EXISTS idx_tarefas_status ON public.tarefas(status);
CREATE INDEX IF NOT EXISTS idx_tarefas_processo_id ON public.tarefas(processo_id);
CREATE INDEX IF NOT EXISTS idx_movimentacoes_data ON public.movimentacoes(data_movimentacao);
CREATE INDEX IF NOT EXISTS idx_movimentacoes_processo_id ON public.movimentacoes(processo_id);
CREATE INDEX IF NOT EXISTS idx_processos_area ON public.processos(area);