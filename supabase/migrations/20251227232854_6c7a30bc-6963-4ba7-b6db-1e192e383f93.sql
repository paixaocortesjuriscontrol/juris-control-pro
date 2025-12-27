-- Performance indexes for reporting
CREATE INDEX IF NOT EXISTS idx_processos_created_at ON public.processos (created_at);
CREATE INDEX IF NOT EXISTS idx_processos_data_encerramento ON public.processos (data_encerramento);
CREATE INDEX IF NOT EXISTS idx_processos_status ON public.processos (status);
CREATE INDEX IF NOT EXISTS idx_processos_area ON public.processos (area);
CREATE INDEX IF NOT EXISTS idx_processos_cliente_id ON public.processos (cliente_id);
CREATE INDEX IF NOT EXISTS idx_movimentacoes_processo_id ON public.movimentacoes (processo_id);
CREATE INDEX IF NOT EXISTS idx_movimentacoes_data_movimentacao ON public.movimentacoes (data_movimentacao);
CREATE INDEX IF NOT EXISTS idx_prazos_processo_id ON public.prazos (processo_id);
CREATE INDEX IF NOT EXISTS idx_prazos_status ON public.prazos (status);

-- Fix + optimize: Relatório Resumo (avoid timeout)
CREATE OR REPLACE FUNCTION public.get_relatorio_resumo()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
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
  -- Increase timeout only for this report execution
  PERFORM set_config('statement_timeout', '60000', true);

  SELECT
    COUNT(*)::int,
    COUNT(*) FILTER (
      WHERE status = 'ativo'
        AND created_at >= date_trunc('year', now())
        AND created_at <  date_trunc('year', now()) + interval '1 year'
    )::int,
    COALESCE(
      to_char(
        AVG(
          (
            COALESCE(array_length(string_to_array(NULLIF(polo_ativo, ''), ','), 1), 0)
            +
            COALESCE(array_length(string_to_array(NULLIF(polo_passivo, ''), ','), 1), 0)
          )::numeric
        ),
        'FM999990.0'
      ),
      '0'
    )
  INTO total_processos, processos_ativos_ano, media_env
  FROM public.processos;

  SELECT COUNT(*)::int INTO total_mov FROM public.movimentacoes;

  -- Processos por área
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
  INTO processos_per_area
  FROM (
    SELECT area, COUNT(*)::int AS total
    FROM public.processos
    GROUP BY area
  ) t;

  -- Processos por tipo de pessoa
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'name', tipo_nome,
        'value', total,
        'color',
        CASE tipo_key
          WHEN 'pessoa_fisica' THEN '#3B82F6'
          WHEN 'pessoa_juridica' THEN '#8B5CF6'
          ELSE '#94A3B8'
        END
      )
      ORDER BY total DESC
    ),
    '[]'::jsonb
  )
  INTO processos_tipo_pessoa
  FROM (
    SELECT
      COALESCE(c.tipo, 'sem_cliente') as tipo_key,
      CASE COALESCE(c.tipo, 'sem_cliente')
        WHEN 'pessoa_fisica' THEN 'Pessoa Física'
        WHEN 'pessoa_juridica' THEN 'Pessoa Jurídica'
        ELSE 'Sem Cliente'
      END as tipo_nome,
      COUNT(p.id)::int as total
    FROM public.processos p
    LEFT JOIN public.clientes c ON c.id = p.cliente_id
    GROUP BY 1, 2
  ) t;

  -- Movimentação mensal (últimos 6 meses)
  WITH meses AS (
    SELECT
      date_trunc('month', now()) - (gs || ' months')::interval AS mes_inicio,
      to_char(date_trunc('month', now()) - (gs || ' months')::interval, 'Mon') AS mes
    FROM generate_series(5, 0, -1) gs
  ),
  novos AS (
    SELECT date_trunc('month', created_at) AS mes_inicio, COUNT(*)::int AS novos
    FROM public.processos
    GROUP BY 1
  ),
  encerrados AS (
    SELECT date_trunc('month', data_encerramento) AS mes_inicio, COUNT(*)::int AS encerrados
    FROM public.processos
    WHERE data_encerramento IS NOT NULL
    GROUP BY 1
  )
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'mes', m.mes,
        'novos', COALESCE(n.novos, 0),
        'encerrados', COALESCE(e.encerrados, 0)
      )
      ORDER BY m.mes_inicio
    ),
    '[]'::jsonb
  )
  INTO processos_mensais
  FROM meses m
  LEFT JOIN novos n USING (mes_inicio)
  LEFT JOIN encerrados e USING (mes_inicio);

  result := jsonb_build_object(
    'totalProcessos', total_processos,
    'processosAtivosAnoAtual', processos_ativos_ano,
    'mediaEnvolvidos', media_env,
    'totalMovimentacoes', total_mov,
    'processosPerArea', processos_per_area,
    'processosPorTipoPessoa', processos_tipo_pessoa,
    'processosMensais', processos_mensais
  );

  RETURN result;
END;
$$;

-- Fix + optimize: Relatório Clientes (fix EXTRACT error + speed)
CREATE OR REPLACE FUNCTION public.get_relatorio_clientes()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $$
DECLARE
  result jsonb;
  proc_por_cliente jsonb;
  proc_por_vara jsonb;
  duracao_cli jsonb;
  ativ_por_tarefa jsonb;
  produtividade jsonb;
BEGIN
  PERFORM set_config('statement_timeout', '60000', true);

  -- Produtividade advogados
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

  -- Processos por cliente (com prazos pendentes via LEFT JOIN)
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
      COUNT(prz.id)::int AS prazos_pendentes
    FROM public.clientes c
    JOIN public.processos p ON p.cliente_id = c.id
    LEFT JOIN public.prazos prz ON prz.processo_id = p.id AND prz.status <> 'cumprido'
    GROUP BY c.id, c.nome, c.tipo
    HAVING COUNT(p.id) > 0
  ) t;

  -- Processos por vara
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

  -- Duração dos processos por cliente (média em dias) - FIX: date - date já é dias (int), sem EXTRACT(EPOCH)
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

  -- Atividades por tarefa
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
    FROM public.prazos
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
