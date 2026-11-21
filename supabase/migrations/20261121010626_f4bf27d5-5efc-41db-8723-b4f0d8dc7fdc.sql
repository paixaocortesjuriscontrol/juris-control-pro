CREATE OR REPLACE FUNCTION public.get_ranking_criados_sistema(p_inicio date, p_fim date, p_coordenacao_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(uid uuid, nome text, tipo text, criados integer, atribuidos integer, concluidos integer, no_prazo integer, pendentes integer, atrasados integer, baixou integer, b_no_prazo integer, b_atraso integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
 SET statement_timeout TO '30s'
AS $function$
WITH it AS (
  SELECT 'tarefa'::text AS fonte, t.id, NULL::uuid AS parent_id, t.criado_por,
    CASE WHEN lower(coalesce(t.tipo_tarefa,'')) LIKE 'audi%' THEN 'audiencia'
         WHEN lower(coalesce(t.tipo_tarefa,'')) LIKE 'prazo%' THEN 'prazo'
         WHEN lower(coalesce(t.tipo_tarefa,'')) LIKE 'evento%' THEN 'evento'
         WHEN lower(coalesce(t.tipo_tarefa,'')) LIKE 'parcel%' THEN 'parcelamento'
         ELSE 'tarefa' END AS tipo,
    coalesce(t.data_fatal::date, t.data_vencimento::date, t.data_prevista::date) AS prazo,
    t.data_cumprimento::date AS cumpr,
    t.status::text IN ('cumprido','concluido','tratado','protocolado','baixado','verificado','concluido_sem_sucesso') AS concl,
    t.status::text IN ('cumprido','concluido','tratado','protocolado','baixado','verificado','concluido_sem_sucesso','cancelado','cancelado_oculto','minutado_revisao') AS encerr,
    NULL::uuid AS concluinte_direto
  FROM public.tarefas t
  WHERE (t.origem IS NULL OR t.origem IN ('manual','analise_djen','workflow','ia_djen','publicacao'))
    AND t.created_at >= p_inicio AND t.created_at < p_fim + 1
    AND (p_coordenacao_id IS NULL OR t.coordenacao_id = p_coordenacao_id)

  UNION ALL

  SELECT 'evento'::text, e.id, NULL::uuid, e.criado_por,
    CASE WHEN lower(coalesce(e.tipo,'')) LIKE 'audi%' THEN 'audiencia' ELSE 'evento' END,
    e.data_inicio::date, e.concluido_em::date,
    e.status IN ('cumprido','concluido','tratado','protocolado','baixado','verificado','concluido_sem_sucesso'),
    e.status IN ('cumprido','concluido','tratado','protocolado','baixado','verificado','concluido_sem_sucesso','cancelado','cancelado_oculto','cancelada','minutado_revisao'),
    NULL::uuid
  FROM public.eventos_agenda e
  WHERE (e.origem IS NULL OR e.origem IN ('manual','analise_djen','workflow','ia_djen','publicacao'))
    AND lower(coalesce(e.tipo,'')) NOT LIKE 'parcel%'
    AND e.created_at >= p_inicio AND e.created_at < p_fim + 1
    AND (p_coordenacao_id IS NULL OR e.coordenacao_id = p_coordenacao_id)

  UNION ALL

  SELECT 'audiencia'::text, a.id, NULL::uuid, a.criado_por, 'audiencia'::text,
    a.data_audiencia::date,
    coalesce(a.tratado_em::date, CASE WHEN a.status IN ('cumprido','concluido','tratado','protocolado','baixado','verificado','concluido_sem_sucesso') THEN a.updated_at::date END),
    a.status IN ('cumprido','concluido','tratado','protocolado','baixado','verificado','concluido_sem_sucesso'),
    a.status IN ('cumprido','concluido','tratado','protocolado','baixado','verificado','concluido_sem_sucesso','cancelado','cancelado_oculto','cancelada','minutado_revisao'),
    a.tratado_por
  FROM public.audiencias_detectadas a
  WHERE (a.origem IS NULL OR a.origem IN ('manual','analise_djen','workflow','ia_djen','publicacao'))
    AND a.created_at >= p_inicio AND a.created_at < p_fim + 1
    AND (p_coordenacao_id IS NULL OR a.coordenacao_id = p_coordenacao_id)

  UNION ALL

  SELECT 'parcela'::text, p.id, p.evento_id, e.criado_por, 'parcelamento'::text,
    p.data_vencimento,
    CASE WHEN p.status = 'pago' THEN p.updated_at::date
         WHEN e.status IN ('cumprido','concluido','tratado','protocolado','baixado','verificado','concluido_sem_sucesso') THEN e.concluido_em::date END,
    p.status = 'pago' OR e.status IN ('cumprido','concluido','tratado','protocolado','baixado','verificado','concluido_sem_sucesso'),
    p.status = 'pago' OR p.status IN ('cancelado','cancelado_oculto','cancelada') OR e.status IN ('cumprido','concluido','tratado','protocolado','baixado','verificado','concluido_sem_sucesso','cancelado','cancelado_oculto','cancelada','minutado_revisao'),
    NULL::uuid
  FROM public.parcelas_evento p
  JOIN public.eventos_agenda e ON e.id = p.evento_id
  WHERE (e.origem IS NULL OR e.origem IN ('manual','analise_djen','workflow','ia_djen','publicacao'))
    AND p.created_at >= p_inicio AND p.created_at < p_fim + 1
    AND (p_coordenacao_id IS NULL OR e.coordenacao_id = p_coordenacao_id)
),
resp AS (
  SELECT r.tarefa_id AS id, r.usuario_id AS u
  FROM public.tarefa_responsaveis r JOIN it ON it.fonte = 'tarefa' AND it.id = r.tarefa_id
  UNION
  SELECT t.id, t.responsavel_id
  FROM public.tarefas t JOIN it ON it.fonte = 'tarefa' AND it.id = t.id
  WHERE t.responsavel_id IS NOT NULL
  UNION
  SELECT r.evento_id, r.usuario_id
  FROM public.evento_responsaveis r JOIN it ON it.fonte = 'evento' AND it.id = r.evento_id
  UNION
  SELECT it.id, r.usuario_id
  FROM public.evento_responsaveis r JOIN it ON it.fonte = 'parcela' AND it.parent_id = r.evento_id
  UNION
  SELECT a.audiencia_id, a.advogado_id
  FROM public.audiencias_advogados a JOIN it ON it.fonte = 'audiencia' AND it.id = a.audiencia_id
),
bx AS (
  SELECT DISTINCT ON (a.tarefa_id) a.tarefa_id, a.usuario_id
  FROM public.auditoria_tarefas a
  JOIN it ON it.id = a.tarefa_id AND it.concl
  WHERE a.acao = 'atualizar' AND a.usuario_id IS NOT NULL
    AND (a.dados_saida->>'status') IN ('cumprido','concluido','tratado','protocolado','baixado','verificado','concluido_sem_sucesso')
  ORDER BY a.tarefa_id, a.created_at
),
baixa AS (
  SELECT it.id, it.tipo, it.prazo, it.cumpr, coalesce(bx.usuario_id, it.concluinte_direto) AS u
  FROM it
  LEFT JOIN bx ON bx.tarefa_id = it.id
  WHERE it.concl AND coalesce(bx.usuario_id, it.concluinte_direto) IS NOT NULL
),
ev AS (
  SELECT criado_por AS u, tipo, 1 c,0 a,0 k,0 np,0 p,0 at,0 b,0 bn,0 ba
  FROM it WHERE criado_por IS NOT NULL
  UNION ALL
  SELECT r.u, it.tipo, 0,1, it.concl::int,
    (it.concl AND it.prazo IS NOT NULL AND it.cumpr IS NOT NULL AND it.cumpr <= it.prazo)::int,
    (NOT it.encerr)::int, (NOT it.encerr AND it.prazo < current_date)::int, 0,0,0
  FROM resp r JOIN it ON it.id = r.id
  UNION ALL
  SELECT b.u, b.tipo, 0,0,0,0,0,0,1,
    (b.prazo IS NOT NULL AND b.cumpr IS NOT NULL AND b.cumpr <= b.prazo)::int,
    (b.prazo IS NOT NULL AND b.cumpr IS NOT NULL AND b.cumpr > b.prazo)::int
  FROM baixa b
)
SELECT ev.u, coalesce(p.nome,'Sem nome'), ev.tipo,
  sum(ev.c)::int, sum(ev.a)::int, sum(ev.k)::int, sum(ev.np)::int,
  sum(ev.p)::int, sum(ev.at)::int, sum(ev.b)::int, sum(ev.bn)::int, sum(ev.ba)::int
FROM ev
LEFT JOIN public.profiles p ON p.id = ev.u
WHERE ev.u IS NOT NULL
GROUP BY ev.u, p.nome, ev.tipo
$function$;

REVOKE ALL ON FUNCTION public.get_ranking_criados_sistema(date, date, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_ranking_criados_sistema(date, date, uuid) TO authenticated, service_role;