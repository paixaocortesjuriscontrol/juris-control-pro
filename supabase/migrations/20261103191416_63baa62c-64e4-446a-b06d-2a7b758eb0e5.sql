SELECT set_config('app.sem_notificacao','on',true);
UPDATE public.tarefas t SET modelo_tarefa_id = m.id
FROM (SELECT DISTINCT ON (coordenacao_id, upper(trim(nome))) id, coordenacao_id, upper(trim(nome)) k
      FROM public.modelos_titulo_coordenacao WHERE ativo IS NOT FALSE ORDER BY coordenacao_id, upper(trim(nome)), created_at) m
WHERE t.origem='workflow' AND t.modelo_tarefa_id IS NULL
  AND m.coordenacao_id=t.coordenacao_id AND m.k=upper(trim(t.titulo));