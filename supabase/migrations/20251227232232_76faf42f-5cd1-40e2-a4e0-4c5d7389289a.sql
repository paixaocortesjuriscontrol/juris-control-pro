-- Create RPC functions to compute report aggregates server-side

-- 1) Resumo
CREATE OR REPLACE FUNCTION public.get_relatorio_resumo()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  result jsonb;
  total_processos int;
  processos_ativos_ano int;
  media_env text;
  total_mov int;
  processos_per_area jsonb;
  processos_tipo_pessoa jsonb;
  processos_mensais jsonb;
BEGIN
  -- Total processos
  SELECT COUNT(*)::int INTO total_processos FROM public.processos;
  
  -- Total movimentações
  SELECT COUNT(*)::int INTO total_mov FROM public.movimentacoes;
  
  -- Processos ativos ano atual
  SELECT COUNT(*)::int INTO processos_ativos_ano
  FROM public.processos
  WHERE status = 'ativo' AND EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM now());
  
  -- Média envolvidos (simplificado)
  SELECT COALESCE(
    to_char(
      (SUM(
        COALESCE(array_length(string_to_array(COALESCE(polo_ativo,''), ','), 1), 0) +
        COALESCE(array_length(string_to_array(COALESCE(polo_passivo,''), ','), 1), 0)
      )::numeric / NULLIF(COUNT(*), 0)::numeric),
      'FM999990.0'
    ), '0'
  ) INTO media_env
  FROM public.processos;
  
  -- Processos por área
  SELECT jsonb_agg(jsonb_build_object('name', name, 'value', value, 'color', color) ORDER BY sort)
  INTO processos_per_area
  FROM (
    SELECT 1 as sort, 'Cível' as name, COUNT(*) FILTER (WHERE area = 'civil')::int as value, '#3B82F6' as color FROM public.processos
    UNION ALL
    SELECT 2, 'Trabalhista', COUNT(*) FILTER (WHERE area = 'trabalhista')::int, '#22C55E' FROM public.processos
    UNION ALL
    SELECT 3, 'Empresarial', COUNT(*) FILTER (WHERE area = 'empresarial')::int, '#8B5CF6' FROM public.processos
  ) t;
  
  -- Processos por tipo pessoa
  SELECT jsonb_agg(jsonb_build_object('name', name, 'value', value, 'color', color) ORDER BY sort)
  INTO processos_tipo_pessoa
  FROM (
    SELECT 1 as sort, 'Pessoa Física' as name, 
      (SELECT COUNT(*)::int FROM public.processos p JOIN public.clientes c ON c.id = p.cliente_id WHERE c.tipo = 'pessoa_fisica') as value,
      '#3B82F6' as color
    UNION ALL
    SELECT 2, 'Pessoa Jurídica',
      (SELECT COUNT(*)::int FROM public.processos p JOIN public.clientes c ON c.id = p.cliente_id WHERE c.tipo = 'pessoa_juridica'),
      '#8B5CF6'
    UNION ALL
    SELECT 3, 'Sem Cliente',
      (SELECT COUNT(*)::int FROM public.processos WHERE cliente_id IS NULL),
      '#94A3B8'
  ) t;
  
  -- Processos mensais (últimos 6 meses)
  SELECT jsonb_agg(jsonb_build_object('mes', mes, 'novos', novos, 'encerrados', encerrados) ORDER BY mes_inicio)
  INTO processos_mensais
  FROM (
    SELECT 
      date_trunc('month', now() - (gs || ' months')::interval)::date as mes_inicio,
      to_char(date_trunc('month', now() - (gs || ' months')::interval), 'Mon') as mes,
      (SELECT COUNT(*)::int FROM public.processos 
       WHERE date_trunc('month', created_at) = date_trunc('month', now() - (gs || ' months')::interval)) as novos,
      (SELECT COUNT(*)::int FROM public.processos 
       WHERE data_encerramento IS NOT NULL 
       AND date_trunc('month', data_encerramento) = date_trunc('month', now() - (gs || ' months')::interval)) as encerrados
    FROM generate_series(5, 0, -1) gs
  ) t;
  
  result := jsonb_build_object(
    'totalProcessos', total_processos,
    'processosAtivosAnoAtual', processos_ativos_ano,
    'mediaEnvolvidos', media_env,
    'totalMovimentacoes', total_mov,
    'processosPerArea', COALESCE(processos_per_area, '[]'::jsonb),
    'processosPorTipoPessoa', COALESCE(processos_tipo_pessoa, '[]'::jsonb),
    'processosMensais', COALESCE(processos_mensais, '[]'::jsonb)
  );
  
  RETURN result;
END;
$$;

-- 2) Atividades
CREATE OR REPLACE FUNCTION public.get_relatorio_atividades()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
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
BEGIN
  SELECT COUNT(*)::int INTO total_prazos FROM public.prazos;
  SELECT COUNT(*)::int INTO ativ_concluidas FROM public.prazos WHERE status = 'cumprido';
  SELECT COUNT(*)::int INTO ativ_nao_concluidas FROM public.prazos WHERE status <> 'cumprido';
  
  -- Prazos status
  SELECT jsonb_agg(jsonb_build_object('name', name, 'value', value, 'color', color) ORDER BY sort)
  INTO prazos_status
  FROM (
    SELECT 1 as sort, 'Cumpridos' as name, COUNT(*) FILTER (WHERE status = 'cumprido')::int as value, '#22C55E' as color FROM public.prazos
    UNION ALL
    SELECT 2, 'Pendentes', COUNT(*) FILTER (WHERE status = 'pendente')::int, '#EAB308' FROM public.prazos
    UNION ALL
    SELECT 3, 'Atrasados', COUNT(*) FILTER (WHERE status = 'atrasado')::int, '#EF4444' FROM public.prazos
  ) t;
  
  -- Atividades por área
  SELECT jsonb_agg(jsonb_build_object('name', name, 'concluidas', concluidas, 'pendentes', pendentes) ORDER BY sort)
  INTO ativ_por_area
  FROM (
    SELECT 1 as sort, 'Cível' as name,
      (SELECT COUNT(*)::int FROM public.prazos pr JOIN public.processos p ON p.id = pr.processo_id WHERE p.area = 'civil' AND pr.status = 'cumprido') as concluidas,
      (SELECT COUNT(*)::int FROM public.prazos pr JOIN public.processos p ON p.id = pr.processo_id WHERE p.area = 'civil' AND pr.status <> 'cumprido') as pendentes
    UNION ALL
    SELECT 2, 'Trabalhista',
      (SELECT COUNT(*)::int FROM public.prazos pr JOIN public.processos p ON p.id = pr.processo_id WHERE p.area = 'trabalhista' AND pr.status = 'cumprido'),
      (SELECT COUNT(*)::int FROM public.prazos pr JOIN public.processos p ON p.id = pr.processo_id WHERE p.area = 'trabalhista' AND pr.status <> 'cumprido')
    UNION ALL
    SELECT 3, 'Empresarial',
      (SELECT COUNT(*)::int FROM public.prazos pr JOIN public.processos p ON p.id = pr.processo_id WHERE p.area = 'empresarial' AND pr.status = 'cumprido'),
      (SELECT COUNT(*)::int FROM public.prazos pr JOIN public.processos p ON p.id = pr.processo_id WHERE p.area = 'empresarial' AND pr.status <> 'cumprido')
  ) t;
  
  -- Evolução andamentos por ano
  SELECT jsonb_agg(jsonb_build_object('ano', ano::text, 'total', total) ORDER BY ano)
  INTO evolucao_and
  FROM (
    SELECT EXTRACT(YEAR FROM data_movimentacao)::int as ano, COUNT(*)::int as total
    FROM public.movimentacoes
    GROUP BY 1
  ) t;
  
  -- Andamentos por área
  SELECT jsonb_agg(jsonb_build_object('name', name, 'value', value, 'color', color) ORDER BY sort)
  INTO and_por_area
  FROM (
    SELECT 1 as sort, 'Cível' as name,
      (SELECT COUNT(*)::int FROM public.movimentacoes m JOIN public.processos p ON p.id = m.processo_id WHERE p.area = 'civil') as value,
      '#3B82F6' as color
    UNION ALL
    SELECT 2, 'Trabalhista',
      (SELECT COUNT(*)::int FROM public.movimentacoes m JOIN public.processos p ON p.id = m.processo_id WHERE p.area = 'trabalhista'),
      '#22C55E'
    UNION ALL
    SELECT 3, 'Empresarial',
      (SELECT COUNT(*)::int FROM public.movimentacoes m JOIN public.processos p ON p.id = m.processo_id WHERE p.area = 'empresarial'),
      '#8B5CF6'
  ) t;
  
  result := jsonb_build_object(
    'totalPrazos', total_prazos,
    'prazosStatus', COALESCE(prazos_status, '[]'::jsonb),
    'atividadesConcluidas', ativ_concluidas,
    'atividadesNaoConcluidas', ativ_nao_concluidas,
    'atividadesPorArea', COALESCE(ativ_por_area, '[]'::jsonb),
    'evolucaoAndamentos', COALESCE(evolucao_and, '[]'::jsonb),
    'andamentosPorArea', COALESCE(and_por_area, '[]'::jsonb)
  );
  
  RETURN result;
END;
$$;

-- 3) Clientes
CREATE OR REPLACE FUNCTION public.get_relatorio_clientes()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  result jsonb;
  proc_por_cliente jsonb;
  proc_por_vara jsonb;
  duracao_cli jsonb;
  ativ_por_tarefa jsonb;
  produtividade jsonb;
BEGIN
  -- Produtividade advogados
  SELECT jsonb_agg(jsonb_build_object('nome', nome, 'processos', processos) ORDER BY processos DESC)
  INTO produtividade
  FROM (
    SELECT pr.nome, COUNT(p.id)::int as processos
    FROM public.processos p
    JOIN public.profiles pr ON pr.id = p.advogado_responsavel_id
    GROUP BY pr.nome
    HAVING COUNT(p.id) > 0
    ORDER BY COUNT(p.id) DESC
    LIMIT 5
  ) t;
  
  -- Processos por cliente
  SELECT jsonb_agg(item ORDER BY total DESC)
  INTO proc_por_cliente
  FROM (
    SELECT jsonb_build_object(
      'nome', c.nome,
      'tipo', c.tipo,
      'total', COUNT(p.id)::int,
      'ativos', COUNT(p.id) FILTER (WHERE p.status = 'ativo')::int,
      'encerrados', COUNT(p.id) FILTER (WHERE p.status IN ('encerrado', 'arquivado'))::int,
      'prazosPendentes', (SELECT COUNT(*)::int FROM public.prazos prz WHERE prz.processo_id = ANY(ARRAY_AGG(p.id)) AND prz.status <> 'cumprido')
    ) as item,
    COUNT(p.id) as total
    FROM public.clientes c
    JOIN public.processos p ON p.cliente_id = c.id
    GROUP BY c.id, c.nome, c.tipo
    HAVING COUNT(p.id) > 0
  ) t;
  
  -- Processos por vara
  SELECT jsonb_agg(jsonb_build_object('vara', vara, 'total', total) ORDER BY total DESC)
  INTO proc_por_vara
  FROM (
    SELECT COALESCE(vara, 'Não informada') as vara, COUNT(*)::int as total
    FROM public.processos
    GROUP BY 1
    ORDER BY 2 DESC
    LIMIT 10
  ) t;
  
  -- Duração clientes
  SELECT jsonb_agg(jsonb_build_object('nome', nome, 'mediaDias', media_dias, 'processos', processos) ORDER BY processos DESC)
  INTO duracao_cli
  FROM (
    SELECT 
      c.nome,
      COUNT(p.id)::int as processos,
      ROUND(AVG(EXTRACT(EPOCH FROM (COALESCE(p.data_encerramento, now()::date) - COALESCE(p.data_distribuicao, p.created_at::date))) / 86400))::int as media_dias
    FROM public.clientes c
    JOIN public.processos p ON p.cliente_id = c.id
    GROUP BY c.nome
    HAVING COUNT(p.id) > 0
    ORDER BY COUNT(p.id) DESC
    LIMIT 10
  ) t;
  
  -- Atividades por tarefa
  SELECT jsonb_agg(jsonb_build_object('titulo', titulo, 'total', total, 'concluidas', concluidas, 'atrasadas', atrasadas) ORDER BY total DESC)
  INTO ativ_por_tarefa
  FROM (
    SELECT 
      COALESCE(titulo, 'Sem título') as titulo,
      COUNT(*)::int as total,
      COUNT(*) FILTER (WHERE status = 'cumprido')::int as concluidas,
      COUNT(*) FILTER (WHERE status = 'atrasado')::int as atrasadas
    FROM public.prazos
    GROUP BY 1
    ORDER BY 2 DESC
    LIMIT 10
  ) t;
  
  result := jsonb_build_object(
    'processosPorCliente', COALESCE(proc_por_cliente, '[]'::jsonb),
    'processosPorVara', COALESCE(proc_por_vara, '[]'::jsonb),
    'duracaoClientes', COALESCE(duracao_cli, '[]'::jsonb),
    'atividadesPorTarefa', COALESCE(ativ_por_tarefa, '[]'::jsonb),
    'produtividadeAdvogados', COALESCE(produtividade, '[]'::jsonb)
  );
  
  RETURN result;
END;
$$;
