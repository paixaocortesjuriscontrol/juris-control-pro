CREATE OR REPLACE FUNCTION public.get_ranking_atendimento_geral(p_inicio date, p_fim date, p_coordenacao_id uuid DEFAULT NULL::uuid, p_usuario_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(usuario_id uuid, nome text, abertos_prazos bigint, abertos_tarefas bigint, abertos_audiencias bigint, abertos_eventos bigint, abertos_parcelamentos bigint, abertos_total bigint, concluidos bigint, concluidos_no_prazo bigint, concluidos_atraso bigint, prazos_perdidos bigint, atividades_total bigint, atividades_concluidas bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
WITH tar_base AS (
 SELECT t.id,t.criado_por,t.coordenacao_id,t.created_at,t.status::text status,t.data_cumprimento,t.responsavel_id,lower(coalesce(t.origem,'')) origem,
 CASE WHEN lower(coalesce(t.tipo_tarefa,'')) LIKE 'audi%' THEN 'audiencia' WHEN lower(coalesce(t.tipo_tarefa,'')) LIKE 'prazo%' THEN 'prazo' WHEN lower(coalesce(t.tipo_tarefa,'')) LIKE 'evento%' THEN 'evento' WHEN lower(coalesce(t.tipo_tarefa,'')) LIKE 'parcel%' THEN 'parcelamento' ELSE 'tarefa' END tipo,
 coalesce(t.data_fatal,t.data_vencimento,t.data_prevista) prazo
 FROM public.tarefas t WHERE p_coordenacao_id IS NULL OR t.coordenacao_id=p_coordenacao_id
),
tar AS (
 SELECT b.*,
  b.origem IN ('astrea','projuris','importacao','import','planilha','migracao','carga','benner') AS importada,
  CASE WHEN b.origem IN ('astrea','projuris','importacao','import','planilha','migracao','carga','benner') THEN a.data_original ELSE b.data_cumprimento END data_conclusao_filtro
 FROM tar_base b LEFT JOIN LATERAL (
  SELECT CASE WHEN at.dados_saida->>'data_cumprimento' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' THEN (at.dados_saida->>'data_cumprimento')::timestamptz END data_original
  FROM public.auditoria_tarefas at WHERE at.tarefa_id=b.id AND at.acao='criar' ORDER BY at.created_at LIMIT 1
 ) a ON true
),
resp AS (
 SELECT tarefa_id,usuario_id FROM public.tarefa_responsaveis UNION SELECT tarefa_id,usuario_id FROM public.tarefa_envolvidos UNION SELECT id,responsavel_id FROM public.tarefas WHERE responsavel_id IS NOT NULL
),
tar_resp AS (SELECT r.usuario_id uid,t.* FROM tar t JOIN resp r ON r.tarefa_id=t.id),
abertura AS (
 -- Tarefas criadas manualmente no sistema: crédito para quem criou (data real de criação)
 SELECT t.id,t.tipo,t.criado_por uid FROM tar t
  WHERE NOT t.importada AND t.criado_por IS NOT NULL AND t.created_at::date BETWEEN p_inicio AND p_fim
 UNION
 -- Tarefas importadas em massa (ou sem autor): crédito para responsáveis/envolvidos reais.
 -- A data de referência NÃO é o created_at (data da carga), mas a data do prazo/compromisso
 -- da tarefa; se não houver prazo, cai para o created_at.
 SELECT t.id,t.tipo,r.usuario_id FROM tar t JOIN resp r ON r.tarefa_id=t.id
  WHERE (t.importada OR t.criado_por IS NULL) AND r.usuario_id IS NOT NULL
    AND coalesce(t.prazo, t.created_at::date) BETWEEN p_inicio AND p_fim
),
abertos AS (
 SELECT uid,count(*) FILTER(WHERE tipo='prazo') a_prazos,count(*) FILTER(WHERE tipo='tarefa') a_tarefas,count(*) FILTER(WHERE tipo='audiencia') a_audiencias,count(*) FILTER(WHERE tipo='evento') a_eventos,count(*) FILTER(WHERE tipo='parcelamento') a_parcelamentos,count(*) a_total FROM abertura GROUP BY uid
),
concl AS (
 SELECT uid,count(*) c_total,count(*) FILTER(WHERE prazo IS NULL OR data_conclusao_filtro::date<=prazo) c_prazo,count(*) FILTER(WHERE prazo IS NOT NULL AND data_conclusao_filtro::date>prazo) c_atraso FROM tar_resp
 WHERE status IN ('cumprido','tratado','protocolado','baixado','verificado','concluido_sem_sucesso') AND data_conclusao_filtro IS NOT NULL AND data_conclusao_filtro::date BETWEEN p_inicio AND p_fim GROUP BY uid
),
perdidos AS (
 SELECT uid,count(*) p_total FROM tar_resp WHERE prazo IS NOT NULL AND prazo BETWEEN p_inicio AND p_fim AND ((status IN ('cumprido','tratado','protocolado','baixado','verificado') AND data_conclusao_filtro IS NOT NULL AND data_conclusao_filtro::date>prazo) OR (status NOT IN ('cumprido','tratado','protocolado','baixado','verificado','cancelado','concluido_sem_sucesso') AND prazo<current_date)) GROUP BY uid
),
ativ_base AS (
 SELECT DISTINCT s.id,u.uid,s.concluida_em,s.data_prevista,s.created_at FROM public.subatividades_item s JOIN tar t ON t.id=s.item_id CROSS JOIN LATERAL (SELECT s.responsavel_id uid UNION SELECT s.concluida_por UNION SELECT r.usuario_id FROM resp r WHERE r.tarefa_id=s.item_id) u WHERE u.uid IS NOT NULL
),
ativ AS (
 SELECT uid,count(*) FILTER(WHERE created_at::date<=p_fim AND (coalesce(data_prevista,created_at::date)>=p_inicio OR concluida_em::date>=p_inicio)) at_total,count(*) FILTER(WHERE concluida_em::date BETWEEN p_inicio AND p_fim) at_concl FROM ativ_base GROUP BY uid
),
ids AS (SELECT uid FROM abertos UNION SELECT uid FROM concl UNION SELECT uid FROM perdidos UNION SELECT uid FROM ativ)
SELECT i.uid,coalesce(p.nome,'Sem nome'),coalesce(a.a_prazos,0),coalesce(a.a_tarefas,0),coalesce(a.a_audiencias,0),coalesce(a.a_eventos,0),coalesce(a.a_parcelamentos,0),coalesce(a.a_total,0),coalesce(c.c_total,0),coalesce(c.c_prazo,0),coalesce(c.c_atraso,0),coalesce(pd.p_total,0),coalesce(av.at_total,0),coalesce(av.at_concl,0)
FROM ids i LEFT JOIN abertos a ON a.uid=i.uid LEFT JOIN concl c ON c.uid=i.uid LEFT JOIN perdidos pd ON pd.uid=i.uid LEFT JOIN ativ av ON av.uid=i.uid LEFT JOIN public.profiles p ON p.id=i.uid
WHERE i.uid IS NOT NULL AND (p_usuario_id IS NULL OR i.uid=p_usuario_id) ORDER BY coalesce(a.a_total,0) DESC,coalesce(c.c_total,0) DESC;
$function$;