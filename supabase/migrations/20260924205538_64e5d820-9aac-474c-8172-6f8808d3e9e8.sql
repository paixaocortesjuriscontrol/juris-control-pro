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
WITH base_tst AS (
  SELECT b.*,
         COALESCE(b.data_distribuicao, b.data_distribuicao_planilha, b.created_at::date) AS dt,
         NULLIF(regexp_replace(COALESCE(b.processo, ''), '\D', '', 'g'), '') AS numero_n
  FROM public.dados_benner b
  WHERE (p_coordenacao_id IS NULL OR b.coordenacao_id = p_coordenacao_id)
    AND (p_equipe IS NULL OR b.equipe = p_equipe)
    AND (p_tribunal IS NULL OR lower(trim(b.tribunal)) = lower(trim(p_tribunal)))
    AND (p_data_inicio IS NULL OR COALESCE(b.data_distribuicao, b.data_distribuicao_planilha, b.created_at::date) >= p_data_inicio)
    AND (p_data_fim IS NULL OR COALESCE(b.data_distribuicao, b.data_distribuicao_planilha, b.created_at::date) <= p_data_fim)
),
base_processos AS (
  SELECT p.*,
         p.data_distribuicao AS dt,
         NULLIF(regexp_replace(COALESCE(p.numero, ''), '\D', '', 'g'), '') AS numero_n
  FROM public.processos p
  WHERE p_equipe IS NULL
    AND (
      p_coordenacao_id IS NULL
      OR p.coordenacao_id = p_coordenacao_id
      OR EXISTS (
        SELECT 1
        FROM public.processos_coordenacoes_responsaveis pcr
        WHERE pcr.processo_id = p.id
          AND pcr.coordenacao_id = p_coordenacao_id
      )
    )
    AND (p_tribunal IS NULL OR lower(trim(p.tribunal)) = lower(trim(p_tribunal)))
    AND (p_data_inicio IS NULL OR p.data_distribuicao >= p_data_inicio)
    AND (p_data_fim IS NULL OR p.data_distribuicao <= p_data_fim)
    AND NOT EXISTS (
      SELECT 1 FROM base_tst b
      WHERE b.numero_n IS NOT NULL
        AND b.numero_n = NULLIF(regexp_replace(COALESCE(p.numero, ''), '\D', '', 'g'), '')
    )
),
base_unificada AS (
  SELECT dt,
         COALESCE(ganhamos, false) AS ganhou,
         COALESCE(perdemos, false) AS perdeu,
         COALESCE(acordo, false) AS acordo
  FROM base_tst
  UNION ALL
  SELECT dt,
         resultado IN ('Êxito', 'Exito') AS ganhou,
         resultado = 'Sem êxito' AS perdeu,
         false AS acordo
  FROM base_processos
),
totais AS (
  SELECT jsonb_build_object(
    'total', count(*),
    'ganhos', count(*) FILTER (WHERE ganhou),
    'perdidos', count(*) FILTER (WHERE perdeu),
    'acordos', count(*) FILTER (WHERE acordo),
    'sem_resultado', count(*) FILTER (WHERE NOT ganhou AND NOT perdeu AND NOT acordo)
  ) AS v FROM base_unificada
),
por_mes AS (
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'mes', mes, 'total', total, 'ganhos', ganhos, 'perdidos', perdidos, 'acordos', acordos
  ) ORDER BY mes), '[]'::jsonb) AS v
  FROM (
    SELECT to_char(date_trunc('month', dt), 'YYYY-MM') AS mes,
           count(*) AS total,
           count(*) FILTER (WHERE ganhou) AS ganhos,
           count(*) FILTER (WHERE perdeu) AS perdidos,
           count(*) FILTER (WHERE acordo) AS acordos
    FROM base_unificada
    WHERE dt IS NOT NULL
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
    FROM base_tst GROUP BY 1
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
    FROM base_tst GROUP BY 1
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
    FROM base_tst GROUP BY 1
  ) e
),
financeiro AS (
  SELECT jsonb_build_object(
    'valor_causa', COALESCE(sum(valor_causa),0),
    'valor_condenacao', COALESCE(sum(valor_condenacao),0),
    'valor_pago', COALESCE(sum(valor_pago),0),
    'provisionado_provavel', COALESCE(sum(provisionamento_provavel),0)
  ) AS v
  FROM base_processos
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

REVOKE EXECUTE ON FUNCTION public.get_inteligencia_dashboard(uuid, text, date, date, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_inteligencia_dashboard(uuid, text, date, date, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_inteligencia_processos(
  p_coordenacao_id uuid DEFAULT NULL,
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
  SELECT p.*,
    CASE WHEN lower(translate(coalesce(p.area,''),'íÍ','ii')) ~ 'trab' THEN 'Trabalhista'
         WHEN lower(translate(coalesce(p.area,''),'íÍ','ii')) ~ 'civ' THEN 'Cível'
         WHEN coalesce(p.area,'') = '' THEN 'Não informada' ELSE initcap(replace(p.area,'_',' ')) END area_n
  FROM public.processos p
  WHERE (
      p_coordenacao_id IS NULL
      OR p.coordenacao_id = p_coordenacao_id
      OR EXISTS (
        SELECT 1
        FROM public.processos_coordenacoes_responsaveis pcr
        WHERE pcr.processo_id = p.id
          AND pcr.coordenacao_id = p_coordenacao_id
      )
    )
    AND (p_tribunal IS NULL OR lower(trim(p.tribunal)) = lower(trim(p_tribunal)))
    AND (p_data_inicio IS NULL OR p.data_distribuicao >= p_data_inicio)
    AND (p_data_fim IS NULL OR p.data_distribuicao <= p_data_fim)
)
SELECT jsonb_build_object(
  'total', (SELECT count(*) FROM base),
  'ativos', (SELECT count(*) FROM base WHERE status::text IN ('ativo','pendente','urgente','suspenso')),
  'encerrados', (SELECT count(*) FROM base WHERE status::text NOT IN ('ativo','pendente','urgente','suspenso')),
  'resultado', (SELECT jsonb_build_object('exito', count(*) FILTER (WHERE resultado='Êxito'), 'parcial', count(*) FILTER (WHERE resultado='Êxito parcial'), 'sem_exito', count(*) FILTER (WHERE resultado='Sem êxito')) FROM base),
  'por_area', (SELECT COALESCE(jsonb_agg(jsonb_build_object('nome',area_n,'total',n,'valor_causa',vc) ORDER BY n DESC),'[]') FROM (SELECT area_n, count(*) n, COALESCE(sum(valor_causa),0) vc FROM base GROUP BY 1) a),
  'por_tribunal', (SELECT COALESCE(jsonb_agg(jsonb_build_object('nome',t,'total',n,'valor_causa',vc) ORDER BY n DESC),'[]') FROM (SELECT COALESCE(NULLIF(trim(tribunal),''),'Não informado') t, count(*) n, COALESCE(sum(valor_causa),0) vc FROM base GROUP BY 1 ORDER BY 2 DESC LIMIT 15) a),
  'por_mes', (SELECT COALESCE(jsonb_agg(jsonb_build_object('mes',m,'total',n) ORDER BY m),'[]') FROM (SELECT to_char(date_trunc('month',data_distribuicao),'YYYY-MM') m, count(*) n FROM base WHERE data_distribuicao >= (now() AT TIME ZONE 'America/Sao_Paulo')::date - interval '24 months' GROUP BY 1) a)
);
$$;

REVOKE EXECUTE ON FUNCTION public.get_inteligencia_processos(uuid, date, date, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_inteligencia_processos(uuid, date, date, text) TO authenticated, service_role;