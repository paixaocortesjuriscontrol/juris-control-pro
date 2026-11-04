SELECT set_config('app.sem_notificacao','on',true);
SET LOCAL statement_timeout = '15min';
DO $$
DECLARE a uuid;
BEGIN
  SELECT id INTO a FROM profiles WHERE nome ILIKE 'Admin%Paix%' LIMIT 1;
  IF a IS NULL THEN RETURN; END IF;
  DELETE FROM tarefa_responsaveis r USING tarefas t
   WHERE t.id = r.tarefa_id AND t.identificador_projuris IS NOT NULL AND r.usuario_id = a;
  UPDATE tarefas t SET responsavel_id = (
      SELECT r.usuario_id FROM tarefa_responsaveis r WHERE r.tarefa_id = t.id ORDER BY r.created_at LIMIT 1)
   WHERE t.identificador_projuris IS NOT NULL AND t.responsavel_id = a;
  UPDATE tarefas t SET criado_por = NULL
   WHERE t.identificador_projuris IS NOT NULL AND t.criado_por = a;
END $$;