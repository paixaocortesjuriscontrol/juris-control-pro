create index if not exists idx_dados_benner_equipe_trim on public.dados_benner (trim(equipe));
create index if not exists idx_judit_logs_status_created on public.judit_logs (status, created_at desc);

CREATE OR REPLACE FUNCTION public.get_inteligencia_dashboard(p_coordenacao_id uuid DEFAULT NULL::uuid, p_equipe text DEFAULT NULL::text, p_data_inicio date DEFAULT NULL::date, p_data_fim date DEFAULT NULL::date, p_tribunal text DEFAULT NULL::text)
 RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' SET statement_timeout TO '90s'
AS $function$
WITH base_tst AS MATERIALIZED (
  SELECT COALESCE(b.data_distribuicao, b.data_distribuicao_planilha, b.created_at::date) AS dt,
         NULLIF(regexp_replace(COALESCE(b.processo, ''), '\D', '', 'g'), '') AS numero_n,
         COALESCE(b.ganhamos,false) ganhamos, COALESCE(b.perdemos,false) perdemos, COALESCE(b.acordo,false) acordo,
         b.turma, b.relator, b.equipe
  FROM public.dados_benner b
  WHERE (p_coordenacao_id IS NULL OR b.coordenacao_id = p_coordenacao_id)
    AND (p_equipe IS NULL OR b.equipe = p_equipe)
    AND (p_tribunal IS NULL OR lower(trim(b.tribunal)) = lower(trim(p_tribunal)))
    AND (p_data_inicio IS NULL OR COALESCE(b.data_distribuicao, b.data_distribuicao_planilha, b.created_at::date) >= p_data_inicio)
    AND (p_data_fim IS NULL OR COALESCE(b.data_distribuicao, b.data_distribuicao_planilha, b.created_at::date) <= p_data_fim)
),
nums_tst AS MATERIALIZED (SELECT DISTINCT numero_n FROM base_tst WHERE numero_n IS NOT NULL),
base_processos AS MATERIALIZED (
  SELECT p.data_distribuicao AS dt, p.resultado, p.valor_causa, p.valor_condenacao, p.valor_pago, p.provisionamento_provavel,
         NULLIF(regexp_replace(COALESCE(p.numero, ''), '\D', '', 'g'), '') AS numero_n
  FROM public.processos p
  WHERE p_equipe IS NULL
    AND (p_coordenacao_id IS NULL OR p.coordenacao_id = p_coordenacao_id
      OR EXISTS (SELECT 1 FROM public.processos_coordenacoes_responsaveis pcr WHERE pcr.processo_id = p.id AND pcr.coordenacao_id = p_coordenacao_id))
    AND (p_tribunal IS NULL OR lower(trim(p.tribunal)) = lower(trim(p_tribunal)))
    AND (p_data_inicio IS NULL OR p.data_distribuicao >= p_data_inicio)
    AND (p_data_fim IS NULL OR p.data_distribuicao <= p_data_fim)
),
bp AS MATERIALIZED (
  SELECT x.* FROM base_processos x LEFT JOIN nums_tst n ON n.numero_n = x.numero_n WHERE n.numero_n IS NULL
),
base_unificada AS (
  SELECT dt, ganhamos AS ganhou, perdemos AS perdeu, acordo FROM base_tst
  UNION ALL
  SELECT dt, resultado IN ('Êxito','Exito'), resultado = 'Sem êxito', false FROM bp
),
totais AS (
  SELECT jsonb_build_object('total', count(*), 'ganhos', count(*) FILTER (WHERE ganhou), 'perdidos', count(*) FILTER (WHERE perdeu),
    'acordos', count(*) FILTER (WHERE acordo), 'sem_resultado', count(*) FILTER (WHERE NOT ganhou AND NOT perdeu AND NOT acordo)) AS v
  FROM base_unificada
),
por_mes AS (
  SELECT COALESCE(jsonb_agg(jsonb_build_object('mes', mes,'total', total,'ganhos', ganhos,'perdidos', perdidos,'acordos', acordos,'sem_resultado', sem_resultado) ORDER BY mes), '[]'::jsonb) AS v
  FROM (SELECT to_char(date_trunc('month', dt), 'YYYY-MM') AS mes, count(*) total,
          count(*) FILTER (WHERE ganhou) ganhos, count(*) FILTER (WHERE perdeu) perdidos, count(*) FILTER (WHERE acordo) acordos,
          count(*) FILTER (WHERE NOT ganhou AND NOT perdeu AND NOT acordo) sem_resultado
        FROM base_unificada WHERE dt IS NOT NULL GROUP BY 1) m
),
agr AS (
  SELECT 'turma' k, COALESCE(NULLIF(trim(turma),''),'Sem turma') nome, ganhamos, perdemos, acordo FROM base_tst
  UNION ALL SELECT 'relator', COALESCE(NULLIF(trim(relator),''),'Sem relator'), ganhamos, perdemos, acordo FROM base_tst
  UNION ALL SELECT 'equipe', COALESCE(NULLIF(trim(equipe),''),'Sem equipe'), ganhamos, perdemos, acordo FROM base_tst
),
agr2 AS (
  SELECT k, nome, count(*) total, count(*) FILTER (WHERE ganhamos) ganhos, count(*) FILTER (WHERE perdemos) perdidos, count(*) FILTER (WHERE acordo) acordos
  FROM agr GROUP BY 1,2
),
financeiro AS (
  SELECT jsonb_build_object('valor_causa', COALESCE(sum(valor_causa),0), 'valor_condenacao', COALESCE(sum(valor_condenacao),0),
    'valor_pago', COALESCE(sum(valor_pago),0), 'provisionado_provavel', COALESCE(sum(provisionamento_provavel),0)) AS v
  FROM bp
)
SELECT jsonb_build_object(
  'totais', (SELECT v FROM totais),
  'por_mes', (SELECT v FROM por_mes),
  'por_turma', (SELECT COALESCE(jsonb_agg(jsonb_build_object('nome',nome,'total',total,'ganhos',ganhos,'perdidos',perdidos,'acordos',acordos) ORDER BY total DESC),'[]') FROM agr2 WHERE k='turma'),
  'por_relator', (SELECT COALESCE(jsonb_agg(jsonb_build_object('nome',nome,'total',total,'ganhos',ganhos,'perdidos',perdidos,'acordos',acordos) ORDER BY total DESC),'[]') FROM agr2 WHERE k='relator'),
  'por_equipe', (SELECT COALESCE(jsonb_agg(jsonb_build_object('nome',nome,'total',total,'ganhos',ganhos,'perdidos',perdidos,'acordos',acordos) ORDER BY total DESC),'[]') FROM agr2 WHERE k='equipe'),
  'financeiro', (SELECT v FROM financeiro)
);
$function$;
revoke execute on function public.get_inteligencia_dashboard(uuid,text,date,date,text) from public, anon;
grant execute on function public.get_inteligencia_dashboard(uuid,text,date,date,text) to authenticated, service_role;