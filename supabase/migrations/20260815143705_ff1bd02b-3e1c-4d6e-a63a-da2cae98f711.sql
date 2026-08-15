CREATE OR REPLACE FUNCTION public.get_ranking_atendimento_geral(p_inicio date, p_fim date, p_coordenacao_id uuid DEFAULT NULL::uuid, p_usuario_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(usuario_id uuid, nome text, abertos_prazos bigint, abertos_tarefas bigint, abertos_audiencias bigint, abertos_eventos bigint, abertos_parcelamentos bigint, abertos_total bigint, concluidos bigint, concluidos_no_prazo bigint, concluidos_atraso bigint, prazos_perdidos bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
WITH tar AS (
  SELECT
    t.id, t.criado_por, t.coordenacao_id, t.created_at, t.status::text AS status,
    t.data_cumprimento, t.responsavel_id, lower(coalesce(t.origem, '')) AS origem,
    CASE
      WHEN lower(coalesce(t.tipo_tarefa, '')) LIKE 'audi%' THEN 'audiencia'
      WHEN lower(coalesce(t.tipo_tarefa, '')) LIKE 'prazo%' THEN 'prazo'
      WHEN lower(coalesce(t.tipo_tarefa, '')) LIKE 'evento%' THEN 'evento'
      WHEN lower(coalesce(t.tipo_tarefa, '')) LIKE 'parcel%' THEN 'parcelamento'
      ELSE 'tarefa'
    END AS tipo,
    coalesce(t.data_fatal, t.data_vencimento, t.data_prevista) AS prazo
  FROM public.tarefas t
  WHERE (p_coordenacao_id IS NULL OR t.coordenacao_id = p_coordenacao_id)
),
resp AS (
  SELECT tr.tarefa_id, tr.usuario_id FROM public.tarefa_responsaveis tr
  UNION
  SELECT t.id, t.responsavel_id FROM public.tarefas t WHERE t.responsavel_id IS NOT NULL
),
tar_resp AS (
  SELECT r.usuario_id AS uid, t.*
  FROM tar t
  JOIN resp r ON r.tarefa_id = t.id
),
-- Cargas em massa (dados legados) não contam como abertura de itens
tar_validos AS (
  SELECT * FROM tar
  WHERE origem NOT IN ('astrea','projuris','importacao','import','planilha','migracao')
),
abertura AS (
  SELECT t.id, t.tipo, t.criado_por AS uid
  FROM tar_validos t
  WHERE t.criado_por IS NOT NULL
    AND (t.origem = '' OR t.origem NOT IN ('analise_djen','publicacao','robo','sistema'))
    AND t.created_at::date >= p_inicio AND t.created_at::date <= p_fim
  UNION
  SELECT tr.id, tr.tipo, r.usuario_id AS uid
  FROM tar_validos tr
  JOIN resp r ON r.tarefa_id = tr.id
  WHERE r.usuario_id IS NOT NULL
    AND (tr.criado_por IS NULL OR tr.origem IN ('analise_djen','publicacao','robo','sistema'))
    AND tr.created_at::date >= p_inicio AND tr.created_at::date <= p_fim
),
abertos AS (
  SELECT uid,
    count(*) FILTER (WHERE tipo = 'prazo') AS a_prazos,
    count(*) FILTER (WHERE tipo = 'tarefa') AS a_tarefas,
    count(*) FILTER (WHERE tipo = 'audiencia') AS a_audiencias,
    count(*) FILTER (WHERE tipo = 'evento') AS a_eventos,
    count(*) FILTER (WHERE tipo = 'parcelamento') AS a_parcelamentos,
    count(*) AS a_total
  FROM abertura
  GROUP BY uid
),
concl AS (
  SELECT uid,
    count(*) AS c_total,
    count(*) FILTER (WHERE prazo IS NULL OR data_cumprimento::date <= prazo) AS c_prazo,
    count(*) FILTER (WHERE prazo IS NOT NULL AND data_cumprimento::date > prazo) AS c_atraso
  FROM tar_resp
  WHERE status IN ('cumprido','tratado','protocolado','baixado','verificado','concluido_sem_sucesso')
    AND data_cumprimento IS NOT NULL
    AND data_cumprimento::date >= p_inicio AND data_cumprimento::date <= p_fim
  GROUP BY uid
),
perdidos AS (
  SELECT uid, count(*) AS p_total
  FROM tar_resp
  WHERE prazo IS NOT NULL
    AND prazo >= p_inicio AND prazo <= p_fim
    AND (
      (status IN ('cumprido','tratado','protocolado','baixado','verificado') AND data_cumprimento IS NOT NULL AND data_cumprimento::date > prazo)
      OR (status NOT IN ('cumprido','tratado','protocolado','baixado','verificado','cancelado','concluido_sem_sucesso') AND prazo < current_date)
    )
  GROUP BY uid
),
ids AS (
  SELECT uid FROM abertos
  UNION SELECT uid FROM concl
  UNION SELECT uid FROM perdidos
)
SELECT
  i.uid,
  coalesce(p.nome, 'Sem nome') AS nome,
  coalesce(a.a_prazos, 0), coalesce(a.a_tarefas, 0), coalesce(a.a_audiencias, 0),
  coalesce(a.a_eventos, 0), coalesce(a.a_parcelamentos, 0), coalesce(a.a_total, 0),
  coalesce(c.c_total, 0), coalesce(c.c_prazo, 0), coalesce(c.c_atraso, 0),
  coalesce(pd.p_total, 0)
FROM ids i
LEFT JOIN abertos a ON a.uid = i.uid
LEFT JOIN concl c ON c.uid = i.uid
LEFT JOIN perdidos pd ON pd.uid = i.uid
LEFT JOIN public.profiles p ON p.id = i.uid
WHERE i.uid IS NOT NULL
  AND (p_usuario_id IS NULL OR i.uid = p_usuario_id)
ORDER BY coalesce(a.a_total, 0) DESC, coalesce(c.c_total, 0) DESC;
$function$;