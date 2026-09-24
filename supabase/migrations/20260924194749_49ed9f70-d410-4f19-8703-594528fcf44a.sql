CREATE OR REPLACE FUNCTION public.get_inteligencia_ofensores(p_coordenacao_id uuid DEFAULT NULL, p_equipe text DEFAULT NULL, p_data_inicio date DEFAULT NULL, p_data_fim date DEFAULT NULL, p_tribunal text DEFAULT NULL)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
WITH base AS (
  SELECT b.*, COALESCE(b.data_distribuicao, b.data_distribuicao_planilha, b.created_at::date) AS dt
  FROM dados_benner b
  WHERE (p_coordenacao_id IS NULL OR b.coordenacao_id = p_coordenacao_id)
    AND (p_equipe IS NULL OR b.equipe = p_equipe)
    AND (p_tribunal IS NULL OR b.tribunal = p_tribunal)
    AND (p_data_inicio IS NULL OR COALESCE(b.data_distribuicao, b.data_distribuicao_planilha, b.created_at::date) >= p_data_inicio)
    AND (p_data_fim IS NULL OR COALESCE(b.data_distribuicao, b.data_distribuicao_planilha, b.created_at::date) <= p_data_fim)
),
ref AS (SELECT date_trunc('month', COALESCE(p_data_fim, (now() AT TIME ZONE 'America/Sao_Paulo')::date))::date AS m),
mat AS (
  SELECT b.id, b.dt, b.ganhamos, b.perdemos, b.acordo,
    NULLIF(trim(both ' .' FROM regexp_replace(trim(x), '^\d+\s*[\.\)-]\s*', '')), '') AS materia
  FROM base b,
  LATERAL unnest(string_to_array(concat_ws(';', b.materias_recurso_reclamante, b.materias_recurso_banco, b.materias_recurso_terceiro), ';')) x
),
mat_ok AS (SELECT DISTINCT id, dt, ganhamos, perdemos, acordo, materia FROM mat WHERE materia IS NOT NULL AND length(materia) BETWEEN 3 AND 200),
recl AS (
  SELECT upper(trim(reclamante)) AS nome, count(*) total,
    count(*) FILTER (WHERE ganhamos) ganhos, count(*) FILTER (WHERE perdemos) perdidos, count(*) FILTER (WHERE acordo) acordos,
    count(*) FILTER (WHERE dt >= (SELECT m FROM ref) - interval '2 months') recente,
    count(*) FILTER (WHERE dt >= (SELECT m FROM ref) - interval '5 months' AND dt < (SELECT m FROM ref) - interval '2 months') anterior
  FROM base WHERE NULLIF(trim(reclamante),'') IS NOT NULL GROUP BY 1
),
mats AS (
  SELECT materia AS nome, count(*) total,
    count(*) FILTER (WHERE ganhamos) ganhos, count(*) FILTER (WHERE perdemos) perdidos, count(*) FILTER (WHERE acordo) acordos,
    count(*) FILTER (WHERE dt >= (SELECT m FROM ref) - interval '2 months') recente,
    count(*) FILTER (WHERE dt >= (SELECT m FROM ref) - interval '5 months' AND dt < (SELECT m FROM ref) - interval '2 months') anterior
  FROM mat_ok GROUP BY 1
),
top_mats AS (SELECT nome FROM mats ORDER BY total DESC LIMIT 6),
evol AS (
  SELECT to_char(date_trunc('month', dt), 'YYYY-MM') mes, materia, count(*) n
  FROM mat_ok WHERE materia IN (SELECT nome FROM top_mats) AND dt >= (SELECT m FROM ref) - interval '11 months'
  GROUP BY 1,2
)
SELECT jsonb_build_object(
  'reclamantes', (SELECT COALESCE(jsonb_agg(to_jsonb(r) ORDER BY total DESC), '[]') FROM (SELECT * FROM recl ORDER BY total DESC LIMIT 30) r),
  'materias', (SELECT COALESCE(jsonb_agg(to_jsonb(m) ORDER BY total DESC), '[]') FROM (SELECT * FROM mats ORDER BY total DESC LIMIT 40) m),
  'top_materias', (SELECT COALESCE(jsonb_agg(nome), '[]') FROM top_mats),
  'evolucao', (SELECT COALESCE(jsonb_agg(jsonb_build_object('mes', mes, 'materia', materia, 'n', n) ORDER BY mes), '[]') FROM evol),
  'alertas', (SELECT COALESCE(jsonb_agg(a ORDER BY (a->>'recente')::int DESC), '[]') FROM (
      SELECT jsonb_build_object('tipo','materia','nome',nome,'recente',recente,'anterior',anterior) a FROM mats WHERE recente >= 5 AND recente >= anterior * 1.5
      UNION ALL
      SELECT jsonb_build_object('tipo','reclamante','nome',nome,'recente',recente,'anterior',anterior) FROM recl WHERE recente >= 3 AND recente >= anterior * 2
    ) s),
  'mes_referencia', (SELECT to_char(m, 'YYYY-MM') FROM ref)
);
$function$;
REVOKE EXECUTE ON FUNCTION public.get_inteligencia_ofensores(uuid,text,date,date,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_inteligencia_ofensores(uuid,text,date,date,text) TO authenticated, service_role;