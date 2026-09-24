CREATE OR REPLACE FUNCTION public.get_inteligencia_dashboard(
  p_coordenacao_id uuid DEFAULT NULL,
  p_equipe text DEFAULT NULL,
  p_data_inicio date DEFAULT NULL,
  p_data_fim date DEFAULT NULL,
  p_tribunal text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
WITH base AS (
  SELECT *
  FROM dados_benner b
  WHERE (p_coordenacao_id IS NULL OR b.coordenacao_id = p_coordenacao_id)
    AND (p_equipe IS NULL OR b.equipe = p_equipe)
    AND (p_tribunal IS NULL OR b.tribunal = p_tribunal)
    AND (p_data_inicio IS NULL OR COALESCE(b.data_distribuicao, b.data_distribuicao_planilha, b.created_at::date) >= p_data_inicio)
    AND (p_data_fim IS NULL OR COALESCE(b.data_distribuicao, b.data_distribuicao_planilha, b.created_at::date) <= p_data_fim)
),
totais AS (
  SELECT jsonb_build_object(
    'total', count(*),
    'ganhos', count(*) FILTER (WHERE ganhamos),
    'perdidos', count(*) FILTER (WHERE perdemos),
    'acordos', count(*) FILTER (WHERE acordo),
    'sem_resultado', count(*) FILTER (WHERE NOT COALESCE(ganhamos,false) AND NOT COALESCE(perdemos,false) AND NOT COALESCE(acordo,false))
  ) AS v FROM base
),
por_mes AS (
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'mes', mes,
    'total', total,
    'ganhos', ganhos,
    'perdidos', perdidos,
    'acordos', acordos
  ) ORDER BY mes), '[]'::jsonb) AS v
  FROM (
    SELECT to_char(date_trunc('month', COALESCE(data_distribuicao, data_distribuicao_planilha, created_at::date)), 'YYYY-MM') AS mes,
           count(*) AS total,
           count(*) FILTER (WHERE ganhamos) AS ganhos,
           count(*) FILTER (WHERE perdemos) AS perdidos,
           count(*) FILTER (WHERE acordo) AS acordos
    FROM base
    GROUP BY 1
  ) m
),
por_turma AS (
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'nome', turma, 'total', total, 'ganhos', ganhos, 'perdidos', perdidos, 'acordos', acordos
  ) ORDER BY total DESC), '[]'::jsonb) AS v
  FROM (
    SELECT COALESCE(NULLIF(trim(turma),''), 'Sem turma') AS turma,
           count(*) AS total,
           count(*) FILTER (WHERE ganhamos) AS ganhos,
           count(*) FILTER (WHERE perdemos) AS perdidos,
           count(*) FILTER (WHERE acordo) AS acordos
    FROM base GROUP BY 1
  ) t
),
por_relator AS (
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'nome', relator, 'total', total, 'ganhos', ganhos, 'perdidos', perdidos, 'acordos', acordos
  ) ORDER BY total DESC), '[]'::jsonb) AS v
  FROM (
    SELECT COALESCE(NULLIF(trim(relator),''), 'Sem relator') AS relator,
           count(*) AS total,
           count(*) FILTER (WHERE ganhamos) AS ganhos,
           count(*) FILTER (WHERE perdemos) AS perdidos,
           count(*) FILTER (WHERE acordo) AS acordos
    FROM base GROUP BY 1
  ) r
),
por_equipe AS (
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'nome', equipe, 'total', total, 'ganhos', ganhos, 'perdidos', perdidos, 'acordos', acordos
  ) ORDER BY total DESC), '[]'::jsonb) AS v
  FROM (
    SELECT COALESCE(NULLIF(trim(equipe),''), 'Sem equipe') AS equipe,
           count(*) AS total,
           count(*) FILTER (WHERE ganhamos) AS ganhos,
           count(*) FILTER (WHERE perdemos) AS perdidos,
           count(*) FILTER (WHERE acordo) AS acordos
    FROM base GROUP BY 1
  ) e
),
financeiro AS (
  SELECT jsonb_build_object(
    'valor_causa', COALESCE(sum(p.valor_causa),0),
    'valor_condenacao', COALESCE(sum(p.valor_condenacao),0),
    'valor_pago', COALESCE(sum(p.valor_pago),0),
    'provisionado_provavel', COALESCE(sum(p.provisionamento_provavel),0)
  ) AS v
  FROM processos p
  WHERE (p_coordenacao_id IS NULL OR p.coordenacao_id = p_coordenacao_id)
    AND (p_data_inicio IS NULL OR p.data_distribuicao >= p_data_inicio)
    AND (p_data_fim IS NULL OR p.data_distribuicao <= p_data_fim)
)
SELECT jsonb_build_object(
  'totais', (SELECT v FROM totais),
  'por_mes', (SELECT v FROM por_mes),
  'por_turma', (SELECT v FROM por_turma),
  'por_relator', (SELECT v FROM por_relator),
  'por_equipe', (SELECT v FROM por_equipe),
  'financeiro', (SELECT v FROM financeiro)
);
$$;

GRANT EXECUTE ON FUNCTION public.get_inteligencia_dashboard(uuid, text, date, date, text) TO authenticated;