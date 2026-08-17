CREATE OR REPLACE FUNCTION public.get_ranking_atendimento_geral(p_inicio date, p_fim date, p_coordenacao_id uuid DEFAULT NULL::uuid, p_usuario_id uuid DEFAULT NULL::uuid)
RETURNS TABLE(usuario_id uuid, nome text, abertos_prazos bigint, abertos_tarefas bigint, abertos_audiencias bigint, abertos_eventos bigint, abertos_parcelamentos bigint, abertos_total bigint, concluidos bigint, concluidos_no_prazo bigint, concluidos_atraso bigint, prazos_perdidos bigint, atividades_total bigint, atividades_concluidas bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
WITH tar_base AS (
  SELECT t.id, t.criado_por, t.coordenacao_id, t.created_at, t.status::text AS status,
    t.data_cumprimento, t.responsavel_id, lower(coalesce(t.origem, '')) AS origem,
    CASE WHEN lower(coalesce(t.tipo_tarefa, '')) LIKE 'audi%' THEN 'audiencia'
      WHEN lower(coalesce(t.tipo_tarefa, '')) LIKE 'prazo%' THEN 'prazo'
      WHEN lower(coalesce(t.tipo_tarefa, '')) LIKE 'evento%' THEN 'evento'
      WHEN lower(coalesce(t.tipo_tarefa, '')) LIKE 'parcel%' THEN 'parcelamento'
      ELSE 'tarefa' END AS tipo,
    coalesce(t.data_fatal, t.data_vencimento, t.data_prevista) AS prazo
  FROM public.tarefas t
  WHERE (p_coordenacao_id IS NULL OR t.coordenacao_id = p_coordenacao_id)
),
tar AS (
  SELECT b.*,
    CASE
      WHEN b.origem IN ('astrea','projuris','importacao','import','planilha','migracao','carga','benner')
        AND a.data_original IS NOT NULL
      THEN a.data_original
      ELSE b.data_cumprimento
    END AS data_conclusao_filtro
  FROM tar_base b
  LEFT JOIN LATERAL (
    SELECT CASE
      WHEN (at.dados_saida->>'data_cumprimento') ~ '^\\d{4}-\\d{2}-\\d{2}'
      THEN (at.dados_saida->>'data_cumprimento')::timestamptz
      ELSE NULL END AS data_original
    FROM public.auditoria_tarefas at
    WHERE at.tarefa_id = b.id AND at.acao = 'criar'
    ORDER BY at.created_at ASC LIMIT 1
  ) a ON true
),
resp AS (
  SELECT tr.tarefa_id, tr.usuario_id FROM public.tarefa_responsaveis tr
  UNION SELECT te.tarefa_id, te.usuario_id FROM public.tarefa_envolvidos te
  UNION SELECT t.id, t.responsavel_id FROM public.tarefas t WHERE t.responsavel_id IS NOT NULL
),
tar_resp AS (SELECT r.usuario_id AS uid, t.* FROM tar t JOIN resp r ON r.tarefa_id=t.id),
tar_validos AS (SELECT * FROM tar WHERE origem NOT IN ('astrea','projuris','importacao','import','planilha','migracao')),
abertura AS (
  SELECT t.id,t.tipo,t.criado_por AS uid FROM tar_validos t
  WHERE t.criado_por IS NOT NULL AND (t.origem='' OR t.origem NOT IN ('analise_djen','publicacao','robo','sistema'))
    AND t.created_at::date BETWEEN p_inicio AND p_fim
  UNION
  SELECT tr.id,tr.tipo,r.usuario_id FROM tar_validos tr JOIN resp r ON r.tarefa_id=tr.id
  WHERE r.usuario_id IS NOT NULL AND (tr.criado_por IS NULL OR tr.origem IN ('analise_djen','publicacao','robo','sistema'))
    AND tr.created_at::date BETWEEN p_inicio AND p_fim
),
abertos AS (
  SELECT uid, count(*) FILTER(WHERE tipo='prazo') AS a_prazos, count(*) FILTER(WHERE tipo='tarefa') AS a_tarefas,
    count(*) FILTER(WHERE tipo='audiencia') AS a_audiencias, count(*) FILTER(WHERE tipo='evento') AS a_eventos,
    count(*) FILTER(WHERE tipo='parcelamento') AS a_parcelamentos, count(*) AS a_total
  FROM abertura GROUP BY uid
),
concl AS (
  SELECT uid, count(*) AS c_total,
    count(*) FILTER(WHERE prazo IS NULL OR data_conclusao_filtro::date<=prazo) AS c_prazo,
    count(*) FILTER(WHERE prazo IS NOT NULL AND data_conclusao_filtro::date>prazo) AS c_atraso
  FROM tar_resp
  WHERE status IN ('cumprido','tratado','protocolado','baixado','verificado','concluido_sem_sucesso')
    AND data_conclusao_filtro IS NOT NULL AND data_conclusao_filtro::date BETWEEN p_inicio AND p_fim
  GROUP BY uid
),
perdidos AS (
  SELECT uid,count(*) AS p_total FROM tar_resp
  WHERE prazo IS NOT NULL AND prazo BETWEEN p_inicio AND p_fim AND (
    (status IN ('cumprido','tratado','protocolado','baixado','verificado') AND data_conclusao_filtro IS NOT NULL AND data_conclusao_filtro::date>prazo)
    OR (status NOT IN ('cumprido','tratado','protocolado','baixado','verificado','cancelado','concluido_sem_sucesso') AND prazo<current_date))
  GROUP BY uid
),
ativ_base AS (
  SELECT DISTINCT s.id,u.uid,s.situacao,s.concluida_em,s.data_prevista,s.created_at
  FROM public.subatividades_item s LEFT JOIN tar t ON t.id=s.item_id
  CROSS JOIN LATERAL (SELECT s.responsavel_id AS uid UNION SELECT s.concluida_por UNION SELECT r.usuario_id FROM resp r WHERE r.tarefa_id=s.item_id) u
  WHERE u.uid IS NOT NULL AND (p_coordenacao_id IS NULL OR t.coordenacao_id=p_coordenacao_id)
),
ativ AS (
  SELECT uid,
    count(*) FILTER(WHERE created_at::date<=p_fim AND (coalesce(data_prevista,created_at::date)>=p_inicio OR (concluida_em IS NOT NULL AND concluida_em::date>=p_inicio))) AS at_total,
    count(*) FILTER(WHERE concluida_em IS NOT NULL AND concluida_em::date BETWEEN p_inicio AND p_fim) AS at_concl
  FROM ativ_base GROUP BY uid
),
ids AS (SELECT uid FROM abertos UNION SELECT uid FROM concl UNION SELECT uid FROM perdidos UNION SELECT uid FROM ativ)
SELECT i.uid,coalesce(p.nome,'Sem nome'),coalesce(a.a_prazos,0),coalesce(a.a_tarefas,0),coalesce(a.a_audiencias,0),coalesce(a.a_eventos,0),coalesce(a.a_parcelamentos,0),coalesce(a.a_total,0),
  coalesce(c.c_total,0),coalesce(c.c_prazo,0),coalesce(c.c_atraso,0),coalesce(pd.p_total,0),coalesce(av.at_total,0),coalesce(av.at_concl,0)
FROM ids i LEFT JOIN abertos a ON a.uid=i.uid LEFT JOIN concl c ON c.uid=i.uid LEFT JOIN perdidos pd ON pd.uid=i.uid LEFT JOIN ativ av ON av.uid=i.uid LEFT JOIN public.profiles p ON p.id=i.uid
WHERE i.uid IS NOT NULL AND (p_usuario_id IS NULL OR i.uid=p_usuario_id)
ORDER BY coalesce(a.a_total,0) DESC,coalesce(c.c_total,0) DESC;
$function$;