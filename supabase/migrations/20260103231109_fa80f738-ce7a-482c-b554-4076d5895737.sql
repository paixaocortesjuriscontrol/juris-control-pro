-- Atualizar função get_relatorio_resumo para incluir processos MPT por status
CREATE OR REPLACE FUNCTION public.get_relatorio_resumo()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET statement_timeout TO '60000'
AS $function$
DECLARE
  result jsonb;
  total_processos int;
  processos_ativos_ano int;
  media_env text;
  total_mov int;
  processos_per_area jsonb;
  processos_tipo_pessoa jsonb;
  processos_mensais jsonb;
  processos_mpt_status jsonb;
BEGIN
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

  -- Processos por área (dinâmico com suporte a areas_atuacao)
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'name', COALESCE(
          aa.nome,
          CASE p.area
            WHEN 'civil' THEN 'Cível'
            WHEN 'trabalhista' THEN 'Trabalhista'
            WHEN 'empresarial' THEN 'Empresarial'
            WHEN 'direito_privado' THEN 'Direito Privado'
            ELSE initcap(replace(p.area, '_', ' '))
          END
        ),
        'value', p.total,
        'color', COALESCE(
          aa.cor,
          CASE p.area
            WHEN 'civil' THEN '#3B82F6'
            WHEN 'trabalhista' THEN '#22C55E'
            WHEN 'empresarial' THEN '#8B5CF6'
            WHEN 'direito_privado' THEN '#F59E0B'
            ELSE '#64748B'
          END
        )
      )
      ORDER BY p.total DESC
    ),
    '[]'::jsonb
  )
  INTO processos_per_area
  FROM (
    SELECT area, COUNT(*)::int AS total
    FROM public.processos
    GROUP BY area
  ) p
  LEFT JOIN public.areas_atuacao aa ON aa.slug = p.area;

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

  -- Processos MPT por status (identificados por materia_mpt preenchida)
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'name', CASE status_key
          WHEN 'ativo' THEN 'Ativo'
          WHEN 'pendente' THEN 'Pendente'
          WHEN 'urgente' THEN 'Urgente'
          WHEN 'encerrado' THEN 'Encerrado'
          WHEN 'arquivado' THEN 'Arquivado'
          ELSE initcap(status_key::text)
        END,
        'value', total,
        'color', CASE status_key
          WHEN 'ativo' THEN '#22C55E'
          WHEN 'pendente' THEN '#EAB308'
          WHEN 'urgente' THEN '#EF4444'
          WHEN 'encerrado' THEN '#6B7280'
          WHEN 'arquivado' THEN '#94A3B8'
          ELSE '#64748B'
        END
      )
      ORDER BY total DESC
    ),
    '[]'::jsonb
  )
  INTO processos_mpt_status
  FROM (
    SELECT status AS status_key, COUNT(*)::int AS total
    FROM public.processos
    WHERE materia_mpt IS NOT NULL AND materia_mpt <> ''
    GROUP BY status
  ) t;

  result := jsonb_build_object(
    'totalProcessos', total_processos,
    'processosAtivosAnoAtual', processos_ativos_ano,
    'mediaEnvolvidos', media_env,
    'totalMovimentacoes', total_mov,
    'processosPerArea', processos_per_area,
    'processosPorTipoPessoa', processos_tipo_pessoa,
    'processosMensais', processos_mensais,
    'processosMptStatus', COALESCE(processos_mpt_status, '[]'::jsonb)
  );

  RETURN result;
END;
$function$;