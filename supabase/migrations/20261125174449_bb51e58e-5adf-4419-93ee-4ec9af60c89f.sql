DO $$
DECLARE cols text;
BEGIN
  PERFORM set_config('app.sem_notificacao','1',true);
  SET LOCAL session_replication_role = replica;

  CREATE TEMP TABLE _dev ON COMMIT DROP AS
  SELECT DISTINCT a.tarefa_id AS id FROM public.auditoria_tarefas a
  WHERE a.tarefa_id IN (SELECT id FROM public.bkp_tarefas_pos_corte_20261125)
    AND a.usuario_id IS NOT NULL AND a.acao NOT IN ('criar','deletar')
    AND a.usuario_id <> 'a318c5eb-c2cc-480a-952a-5c2a42b85fc6'
    AND a.created_at < '2026-11-25 16:40+00';

  SELECT string_agg(quote_ident(c.column_name), ',') INTO cols
  FROM information_schema.columns c
  JOIN information_schema.columns b ON b.table_schema='public' AND b.table_name='bkp_tarefas_pos_corte_20261125' AND b.column_name=c.column_name
  WHERE c.table_schema='public' AND c.table_name='tarefas' AND c.is_generated='NEVER';

  EXECUTE format('INSERT INTO public.tarefas (%s) SELECT %s FROM public.bkp_tarefas_pos_corte_20261125 WHERE id IN (SELECT id FROM _dev) ON CONFLICT (id) DO NOTHING', cols, cols);

  INSERT INTO public.tarefa_responsaveis (id,tarefa_id,usuario_id,created_at)
  SELECT id,tarefa_id,usuario_id,created_at FROM public.bkp_tarefas_pos_corte_resp_20261125 WHERE tarefa_id IN (SELECT id FROM _dev) ON CONFLICT DO NOTHING;
  INSERT INTO public.tarefa_envolvidos (id,tarefa_id,usuario_id,created_at)
  SELECT id,tarefa_id,usuario_id,created_at FROM public.bkp_tarefas_pos_corte_env_20261125 WHERE tarefa_id IN (SELECT id FROM _dev) ON CONFLICT DO NOTHING;
  INSERT INTO public.comentarios_tarefas (id,tarefa_id,autor_id,conteudo,created_at,mencionados,is_cobranca)
  SELECT id,tarefa_id,autor_id,conteudo,created_at,mencionados,is_cobranca FROM public.bkp_tarefas_pos_corte_com_20261125 WHERE tarefa_id IN (SELECT id FROM _dev) ON CONFLICT DO NOTHING;
  UPDATE public.documentos d SET tarefa_id = b.tarefa_id FROM public.bkp_tarefas_pos_corte_doc_20261125 b
  WHERE d.id=b.id AND b.tarefa_id IN (SELECT id FROM _dev) AND d.tarefa_id IS NULL;

  UPDATE public.migracoes_projuris_itens SET status='criado', motivo=NULL
  WHERE registro_id IN (SELECT id FROM _dev) AND status='pulado';
END $$;