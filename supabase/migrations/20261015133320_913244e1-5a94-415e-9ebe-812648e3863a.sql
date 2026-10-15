CREATE OR REPLACE FUNCTION public.get_ranking_criados_sistema(p_inicio date, p_fim date, p_coordenacao_id uuid DEFAULT NULL)
RETURNS TABLE(uid uuid, nome text, tipo text, criados int, atribuidos int, concluidos int, no_prazo int, pendentes int, atrasados int, baixou int, b_no_prazo int, b_atraso int)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$
WITH it AS (
  SELECT t.id, t.criado_por, t.responsavel_id, t.status::text AS status,
    CASE WHEN lower(coalesce(t.tipo_tarefa,'')) LIKE 'audi%' THEN 'audiencia'
         WHEN lower(coalesce(t.tipo_tarefa,'')) LIKE 'prazo%' THEN 'prazo'
         WHEN lower(coalesce(t.tipo_tarefa,'')) LIKE 'evento%' THEN 'evento'
         WHEN lower(coalesce(t.tipo_tarefa,'')) LIKE 'parcel%' THEN 'parcelamento'
         ELSE 'tarefa' END AS tipo,
    coalesce(t.data_fatal::date, t.data_vencimento::date, t.data_prevista::date) AS prazo,
    t.data_cumprimento::date AS cumpr,
    t.status::text IN ('cumprido','tratado','protocolado','baixado','verificado','concluido_sem_sucesso') AS concl,
    t.status::text IN ('cumprido','tratado','protocolado','baixado','verificado','concluido_sem_sucesso','cancelado','cancelado_oculto','minutado_revisao') AS encerr
  FROM tarefas t
  WHERE (t.origem IS NULL OR t.origem IN ('analise_djen','workflow','ia_djen','publicacao'))
    AND t.created_at >= p_inicio AND t.created_at < p_fim + 1
    AND (p_coordenacao_id IS NULL OR t.coordenacao_id = p_coordenacao_id)
),
resp AS (
  SELECT id, responsavel_id AS u FROM it WHERE responsavel_id IS NOT NULL
  UNION
  SELECT r.tarefa_id, r.usuario_id FROM tarefa_responsaveis r JOIN it ON it.id = r.tarefa_id
),
bx AS (
  SELECT DISTINCT ON (a.tarefa_id) a.tarefa_id, a.usuario_id
  FROM auditoria_tarefas a JOIN it ON it.id = a.tarefa_id AND it.concl
  WHERE a.acao = 'atualizar' AND a.usuario_id IS NOT NULL
    AND (a.dados_saida->>'status') IN ('cumprido','tratado','protocolado','baixado','verificado','concluido_sem_sucesso')
  ORDER BY a.tarefa_id, a.created_at
),
ev AS (
  SELECT criado_por AS u, tipo, 1 c,0 a,0 k,0 np,0 p,0 at,0 b,0 bn,0 ba FROM it WHERE criado_por IS NOT NULL
  UNION ALL
  SELECT r.u, it.tipo, 0,1, it.concl::int, (it.concl AND it.prazo IS NOT NULL AND it.cumpr IS NOT NULL AND it.cumpr <= it.prazo)::int,
    (NOT it.encerr)::int, (NOT it.encerr AND it.prazo < current_date)::int, 0,0,0
  FROM resp r JOIN it ON it.id = r.id
  UNION ALL
  SELECT bx.usuario_id, it.tipo, 0,0,0,0,0,0,1,
    (it.prazo IS NOT NULL AND it.cumpr IS NOT NULL AND it.cumpr <= it.prazo)::int,
    (it.prazo IS NOT NULL AND it.cumpr IS NOT NULL AND it.cumpr > it.prazo)::int
  FROM bx JOIN it ON it.id = bx.tarefa_id
)
SELECT ev.u, coalesce(p.nome,'Sem nome'), ev.tipo, sum(c)::int, sum(a)::int, sum(k)::int, sum(np)::int, sum(ev.p)::int, sum(at)::int, sum(b)::int, sum(bn)::int, sum(ba)::int
FROM ev LEFT JOIN profiles p ON p.id = ev.u
GROUP BY ev.u, p.nome, ev.tipo;
$$;
REVOKE ALL ON FUNCTION public.get_ranking_criados_sistema(date,date,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_ranking_criados_sistema(date,date,uuid) TO authenticated;