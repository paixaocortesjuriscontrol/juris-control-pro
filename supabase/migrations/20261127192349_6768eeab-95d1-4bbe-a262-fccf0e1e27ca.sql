SET LOCAL session_replication_role = replica;
DO $$
DECLARE cols text; ids uuid[] := ARRAY['213f73a9-b0ea-49e0-bc5b-86aa3ba9ee56','c800ca54-4384-4303-8200-5101d303a516']::uuid[];
BEGIN
  SELECT string_agg(quote_ident(c.column_name), ',') INTO cols
  FROM information_schema.columns c
  JOIN information_schema.columns t ON t.table_schema='public' AND t.table_name='tarefas' AND t.column_name=c.column_name AND t.is_generated='NEVER'
  WHERE c.table_schema='public' AND c.table_name='backup_copias_antigas_duplicadas_20261127';
  EXECUTE format('INSERT INTO public.tarefas (%s) SELECT %s FROM public.backup_copias_antigas_duplicadas_20261127 WHERE id = ANY(%L::uuid[]) ON CONFLICT (id) DO NOTHING', cols, cols, ids);
  INSERT INTO public.tarefa_responsaveis (id, tarefa_id, usuario_id, created_at) SELECT id, tarefa_id, usuario_id, created_at FROM public.backup_copias_antigas_dup_resp_20261127 WHERE tarefa_id = ANY(ids) ON CONFLICT DO NOTHING;
  INSERT INTO public.tarefa_envolvidos (id, tarefa_id, usuario_id, created_at) SELECT id, tarefa_id, usuario_id, created_at FROM public.backup_copias_antigas_dup_env_20261127 WHERE tarefa_id = ANY(ids) ON CONFLICT DO NOTHING;
  INSERT INTO public.comentarios_tarefas (id, tarefa_id, autor_id, conteudo, created_at, mencionados, is_cobranca) SELECT id, tarefa_id, autor_id, conteudo, created_at, mencionados, is_cobranca FROM public.backup_copias_antigas_dup_com_20261127 WHERE tarefa_id = ANY(ids) ON CONFLICT DO NOTHING;
  INSERT INTO public.migracoes_projuris_itens (id, migracao_id, tipo, chave_externa, registro_id, status, motivo, dados, created_at) SELECT id, migracao_id, tipo, chave_externa, registro_id, status, motivo, dados, created_at FROM public.backup_copias_antigas_dup_mig_20261127 WHERE registro_id = ANY(ids) ON CONFLICT DO NOTHING;
END $$;