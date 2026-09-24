CREATE OR REPLACE FUNCTION public.get_inteligencia_score_exito(p_turma text DEFAULT NULL, p_relator text DEFAULT NULL, p_tipo_recurso text DEFAULT NULL)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
WITH hist AS (
  SELECT upper(trim(turma)) turma, upper(trim(relator)) relator, upper(trim(tipo_recurso_reclamante)) tipo,
         CASE WHEN ganhamos THEN 1.0 ELSE 0.0 END r
  FROM dados_benner WHERE ganhamos OR perdemos
  UNION ALL
  SELECT upper(trim(turma_tst)), upper(trim(relator_tst)), NULL,
         CASE resultado WHEN 'Êxito' THEN 1.0 WHEN 'Êxito parcial' THEN 0.5 ELSE 0.0 END
  FROM processos WHERE resultado IN ('Êxito','Êxito parcial','Sem êxito')
),
p AS (SELECT upper(trim(NULLIF(p_turma,''))) t, upper(trim(NULLIF(p_relator,''))) rl, upper(trim(NULLIF(p_tipo_recurso,''))) tp),
niveis AS (
  SELECT 1 ord, 'Turma + Relator + Tipo de recurso' nivel, count(*) n, avg(r) taxa FROM hist, p WHERE p.t IS NOT NULL AND p.rl IS NOT NULL AND p.tp IS NOT NULL AND hist.turma=p.t AND hist.relator=p.rl AND hist.tipo=p.tp
  UNION ALL SELECT 2, 'Relator + Tipo de recurso', count(*), avg(r) FROM hist, p WHERE p.rl IS NOT NULL AND p.tp IS NOT NULL AND hist.relator=p.rl AND hist.tipo=p.tp
  UNION ALL SELECT 3, 'Relator', count(*), avg(r) FROM hist, p WHERE p.rl IS NOT NULL AND hist.relator=p.rl
  UNION ALL SELECT 4, 'Turma', count(*), avg(r) FROM hist, p WHERE p.t IS NOT NULL AND hist.turma=p.t
  UNION ALL SELECT 5, 'Base geral', count(*), avg(r) FROM hist
),
escolhido AS (SELECT * FROM niveis WHERE n >= 10 ORDER BY ord LIMIT 1)
SELECT jsonb_build_object(
  'score', (SELECT round(taxa*100) FROM escolhido),
  'amostra', (SELECT n FROM escolhido),
  'nivel', (SELECT nivel FROM escolhido),
  'confianca', (SELECT CASE WHEN ord <= 2 AND n >= 30 THEN 'alta' WHEN ord <= 4 AND n >= 20 THEN 'media' ELSE 'baixa' END FROM escolhido),
  'niveis', (SELECT jsonb_agg(jsonb_build_object('nivel',nivel,'n',n,'taxa',round(COALESCE(taxa,0)*100)) ORDER BY ord) FROM niveis WHERE n > 0)
);
$function$;

CREATE OR REPLACE FUNCTION public.get_inteligencia_processos(p_coordenacao_id uuid DEFAULT NULL, p_data_inicio date DEFAULT NULL, p_data_fim date DEFAULT NULL, p_tribunal text DEFAULT NULL)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
WITH base AS (
  SELECT p.*,
    CASE WHEN lower(translate(coalesce(p.area,''),'íÍ','ii')) ~ 'trab' THEN 'Trabalhista'
         WHEN lower(translate(coalesce(p.area,''),'íÍ','ii')) ~ 'civ' THEN 'Cível'
         WHEN coalesce(p.area,'') = '' THEN 'Não informada' ELSE initcap(replace(p.area,'_',' ')) END area_n
  FROM processos p
  WHERE (p_coordenacao_id IS NULL OR p.coordenacao_id = p_coordenacao_id)
    AND (p_tribunal IS NULL OR p.tribunal = p_tribunal)
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
$function$;

REVOKE EXECUTE ON FUNCTION public.get_inteligencia_score_exito(text,text,text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_inteligencia_processos(uuid,date,date,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_inteligencia_score_exito(text,text,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_inteligencia_processos(uuid,date,date,text) TO authenticated, service_role;