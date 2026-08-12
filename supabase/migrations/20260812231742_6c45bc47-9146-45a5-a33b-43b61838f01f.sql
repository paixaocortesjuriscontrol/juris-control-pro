CREATE OR REPLACE FUNCTION public.get_itens_nao_tratados_por_coordenacao(p_coordenacao_ids uuid[])
RETURNS TABLE (
  coordenacao_id uuid,
  tarefas bigint,
  prazos bigint,
  eventos bigint,
  audiencias bigint,
  parcelas bigint,
  total bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
WITH hoje AS (
  SELECT (now() AT TIME ZONE 'America/Sao_Paulo')::date AS d
),
ids AS (
  SELECT unnest(p_coordenacao_ids) AS id
),
t AS (
  SELECT tr.coordenacao_id,
         count(*) FILTER (WHERE coalesce(tr.tipo_registro,'tarefa') <> 'prazo') AS tarefas,
         count(*) FILTER (WHERE tr.tipo_registro = 'prazo') AS prazos
  FROM public.tarefas tr, hoje
  WHERE tr.coordenacao_id = ANY(p_coordenacao_ids)
    AND coalesce(tr.data_fatal, tr.data_vencimento) < hoje.d
    AND lower(tr.status::text) NOT IN ('cumprido','cumprida','cancelado','cancelada','verificado','tratado','tratada','concluido_sem_sucesso','concluido','concluida','arquivado','arquivada')
  GROUP BY tr.coordenacao_id
),
e AS (
  SELECT ev.coordenacao_id, count(*) AS eventos
  FROM public.eventos_agenda ev, hoje
  WHERE ev.coordenacao_id = ANY(p_coordenacao_ids)
    AND (ev.data_inicio AT TIME ZONE 'America/Sao_Paulo')::date < hoje.d
    AND lower(coalesce(ev.status,'')) NOT IN ('cancelado','cancelada','verificado','tratado','tratada','concluido','concluida','arquivado','arquivada','concluido_sem_sucesso')
  GROUP BY ev.coordenacao_id
),
a AS (
  SELECT ad.coordenacao_id, count(*) AS audiencias
  FROM public.audiencias_detectadas ad, hoje
  WHERE ad.coordenacao_id = ANY(p_coordenacao_ids)
    AND (ad.data_audiencia AT TIME ZONE 'America/Sao_Paulo')::date < hoje.d
    AND lower(coalesce(ad.status,'')) NOT IN ('cancelado','cancelada','verificado','tratado','tratada','concluido','concluida','realizada','realizado','ignorado','reagendado','arquivado','arquivada','concluido_sem_sucesso')
  GROUP BY ad.coordenacao_id
),
p AS (
  SELECT ev.coordenacao_id, count(*) AS parcelas
  FROM public.parcelas_evento pe
  JOIN public.eventos_agenda ev ON ev.id = pe.evento_id
  CROSS JOIN hoje
  WHERE ev.coordenacao_id = ANY(p_coordenacao_ids)
    AND pe.data_vencimento < hoje.d
    AND pe.pago_em IS NULL
    AND lower(coalesce(pe.status,'')) NOT IN ('pago','paga','cancelado','cancelada')
    AND lower(coalesce(ev.status,'')) NOT IN ('cancelado','cancelada','concluido','concluida','arquivado','arquivada')
  GROUP BY ev.coordenacao_id
)
SELECT ids.id,
       coalesce(t.tarefas,0),
       coalesce(t.prazos,0),
       coalesce(e.eventos,0),
       coalesce(a.audiencias,0),
       coalesce(p.parcelas,0),
       coalesce(t.tarefas,0) + coalesce(t.prazos,0) + coalesce(e.eventos,0) + coalesce(a.audiencias,0) + coalesce(p.parcelas,0)
FROM ids
LEFT JOIN t ON t.coordenacao_id = ids.id
LEFT JOIN e ON e.coordenacao_id = ids.id
LEFT JOIN a ON a.coordenacao_id = ids.id
LEFT JOIN p ON p.coordenacao_id = ids.id;
$$;

REVOKE ALL ON FUNCTION public.get_itens_nao_tratados_por_coordenacao(uuid[]) FROM public;
GRANT EXECUTE ON FUNCTION public.get_itens_nao_tratados_por_coordenacao(uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_itens_nao_tratados_por_coordenacao(uuid[]) TO service_role;