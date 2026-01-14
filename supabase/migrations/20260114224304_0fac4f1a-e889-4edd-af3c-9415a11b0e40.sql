-- Melhorias de performance/timeout para Relatório de Clientes

-- Índices para acelerar agregações do get_relatorio_clientes
CREATE INDEX IF NOT EXISTS idx_processos_cliente_id ON public.processos (cliente_id);
CREATE INDEX IF NOT EXISTS idx_processos_status ON public.processos (status);
CREATE INDEX IF NOT EXISTS idx_processos_advogado_responsavel_id ON public.processos (advogado_responsavel_id);

-- Contagem de tarefas pendentes por processo (usa filtro status <> 'cumprido')
CREATE INDEX IF NOT EXISTS idx_tarefas_processo_id_pendentes ON public.tarefas (processo_id) WHERE status <> 'cumprido';
CREATE INDEX IF NOT EXISTS idx_tarefas_status ON public.tarefas (status);

-- Recria função com statement_timeout aplicado no nível da função (efetivo para a chamada RPC)
CREATE OR REPLACE FUNCTION public.get_relatorio_clientes()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
SET statement_timeout TO '600s'
AS $$
DECLARE
  result jsonb;
  proc_por_cliente jsonb;
  proc_por_vara jsonb;
  duracao_cli jsonb;
  ativ_por_tarefa jsonb;
  produtividade jsonb;
BEGIN
  -- Produtividade por advogado (Top 5)
  SELECT COALESCE(
    jsonb_agg(jsonb_build_object('nome', nome, 'processos', processos) ORDER BY processos DESC),
    '[]'::jsonb
  )
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

  -- Processos por cliente + prazos/tarefas pendentes (pre-agrupa tarefas para evitar JOIN explosivo)
  WITH tarefas_pendentes_por_processo AS (
    SELECT t.processo_id, COUNT(*)::int AS pendentes
    FROM public.tarefas t
    WHERE t.status <> 'cumprido'
    GROUP BY t.processo_id
  )
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'nome', nome,
        'tipo', tipo,
        'total', total,
        'ativos', ativos,
        'encerrados', encerrados,
        'prazosPendentes', prazos_pendentes
      )
      ORDER BY total DESC
    ),
    '[]'::jsonb
  )
  INTO proc_por_cliente
  FROM (
    SELECT
      c.nome,
      c.tipo,
      COUNT(p.id)::int AS total,
      COUNT(p.id) FILTER (WHERE p.status = 'ativo')::int AS ativos,
      COUNT(p.id) FILTER (WHERE p.status IN ('encerrado', 'arquivado'))::int AS encerrados,
      COALESCE(SUM(tp.pendentes), 0)::int AS prazos_pendentes
    FROM public.clientes c
    JOIN public.processos p ON p.cliente_id = c.id
    LEFT JOIN tarefas_pendentes_por_processo tp ON tp.processo_id = p.id
    GROUP BY c.id, c.nome, c.tipo
    HAVING COUNT(p.id) > 0
  ) t;

  -- Top varas (Top 10)
  SELECT COALESCE(
    jsonb_agg(jsonb_build_object('vara', vara, 'total', total) ORDER BY total DESC),
    '[]'::jsonb
  )
  INTO proc_por_vara
  FROM (
    SELECT COALESCE(vara, 'Não informada') as vara, COUNT(*)::int as total
    FROM public.processos
    GROUP BY 1
    ORDER BY 2 DESC
    LIMIT 10
  ) t;

  -- Duração média (Top 10 por volume)
  SELECT COALESCE(
    jsonb_agg(jsonb_build_object('nome', nome, 'mediaDias', media_dias, 'processos', processos) ORDER BY processos DESC),
    '[]'::jsonb
  )
  INTO duracao_cli
  FROM (
    SELECT
      c.nome,
      COUNT(p.id)::int as processos,
      ROUND(AVG(
        (COALESCE(p.data_encerramento, CURRENT_DATE) - COALESCE(p.data_distribuicao, p.created_at::date))::numeric
      ))::int as media_dias
    FROM public.clientes c
    JOIN public.processos p ON p.cliente_id = c.id
    GROUP BY c.nome
    HAVING COUNT(p.id) > 0
    ORDER BY COUNT(p.id) DESC
    LIMIT 10
  ) t;

  -- Atividades por tipo de tarefa (Top 10)
  SELECT COALESCE(
    jsonb_agg(jsonb_build_object('titulo', titulo, 'total', total, 'concluidas', concluidas, 'atrasadas', atrasadas) ORDER BY total DESC),
    '[]'::jsonb
  )
  INTO ativ_por_tarefa
  FROM (
    SELECT
      COALESCE(titulo, 'Sem título') as titulo,
      COUNT(*)::int as total,
      COUNT(*) FILTER (WHERE status = 'cumprido')::int as concluidas,
      COUNT(*) FILTER (WHERE status = 'atrasado')::int as atrasadas
    FROM public.tarefas
    GROUP BY 1
    ORDER BY 2 DESC
    LIMIT 10
  ) t;

  result := jsonb_build_object(
    'processosPorCliente', proc_por_cliente,
    'processosPorVara', proc_por_vara,
    'duracaoClientes', duracao_cli,
    'atividadesPorTarefa', ativ_por_tarefa,
    'produtividadeAdvogados', produtividade
  );

  RETURN result;
END;
$$;