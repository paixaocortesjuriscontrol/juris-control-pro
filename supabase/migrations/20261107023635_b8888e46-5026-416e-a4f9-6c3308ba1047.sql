SET LOCAL app.sem_notificacao = '1';

WITH alvo AS MATERIALIZED (
  SELECT m.id
  FROM public.modelos_titulo_coordenacao m
  WHERE m.coordenacao_id = '968631d0-6659-46f1-b45d-899892cb0121'
    AND m.criado_por = 'a318c5eb-c2cc-480a-952a-5c2a42b85fc6'
    AND m.created_at >= '2026-11-07 02:15:53+00'
    AND m.created_at < '2026-11-07 02:16:10+00'
    AND (
      length(m.nome) > 80
      OR m.nome ~* '(protocolo:|n[º°o.]*[[:space:]]*processo:|data emissão:|data recebimento:)'
    )
), desvinculadas AS (
  UPDATE public.tarefas t
  SET modelo_tarefa_id = NULL
  FROM alvo
  WHERE t.modelo_tarefa_id = alvo.id
  RETURNING t.id
), removidos AS (
  DELETE FROM public.modelos_titulo_coordenacao m
  USING alvo
  WHERE m.id = alvo.id
  RETURNING m.id
)
SELECT
  (SELECT count(*) FROM removidos) AS modelos_removidos,
  (SELECT count(*) FROM desvinculadas) AS tarefas_desvinculadas;