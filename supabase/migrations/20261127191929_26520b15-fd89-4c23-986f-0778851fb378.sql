SET LOCAL session_replication_role = replica;

DO $$
DECLARE trab uuid; cols text;
BEGIN
  SELECT id INTO trab FROM coordenacoes WHERE nome='Coordenação Santander Trabalhista';
  SELECT string_agg(quote_ident(c.column_name), ',') INTO cols
  FROM information_schema.columns c
  JOIN information_schema.columns t ON t.table_schema='public' AND t.table_name='tarefas' AND t.column_name=c.column_name AND t.is_generated='NEVER'
  WHERE c.table_schema='public' AND c.table_name='backup_copias_antigas_duplicadas_20261127';
  EXECUTE format('INSERT INTO public.tarefas (%s) SELECT %s FROM public.backup_copias_antigas_duplicadas_20261127 WHERE coordenacao_id=%L ON CONFLICT (id) DO NOTHING', cols, cols, trab);

  INSERT INTO public.tarefa_responsaveis (id, tarefa_id, usuario_id, created_at)
  SELECT r.id, r.tarefa_id, r.usuario_id, r.created_at FROM public.backup_copias_antigas_dup_resp_20261127 r
  JOIN public.backup_copias_antigas_duplicadas_20261127 b ON b.id=r.tarefa_id WHERE b.coordenacao_id=trab ON CONFLICT DO NOTHING;
  INSERT INTO public.tarefa_envolvidos (id, tarefa_id, usuario_id, created_at)
  SELECT r.id, r.tarefa_id, r.usuario_id, r.created_at FROM public.backup_copias_antigas_dup_env_20261127 r
  JOIN public.backup_copias_antigas_duplicadas_20261127 b ON b.id=r.tarefa_id WHERE b.coordenacao_id=trab ON CONFLICT DO NOTHING;
  INSERT INTO public.comentarios_tarefas (id, tarefa_id, autor_id, conteudo, created_at, mencionados, is_cobranca)
  SELECT r.id, r.tarefa_id, r.autor_id, r.conteudo, r.created_at, r.mencionados, r.is_cobranca FROM public.backup_copias_antigas_dup_com_20261127 r
  JOIN public.backup_copias_antigas_duplicadas_20261127 b ON b.id=r.tarefa_id WHERE b.coordenacao_id=trab ON CONFLICT DO NOTHING;
  INSERT INTO public.migracoes_projuris_itens (id, migracao_id, tipo, chave_externa, registro_id, status, motivo, dados, created_at)
  SELECT r.id, r.migracao_id, r.tipo, r.chave_externa, r.registro_id, r.status, r.motivo, r.dados, r.created_at FROM public.backup_copias_antigas_dup_mig_20261127 r
  JOIN public.backup_copias_antigas_duplicadas_20261127 b ON b.id=r.registro_id WHERE b.coordenacao_id=trab ON CONFLICT DO NOTHING;
END $$;

WITH errados AS (
  SELECT b.id, b.observacoes FROM public.backup_obs_copias_mantidas_20261127 b
  JOIN public.tarefas o ON o.id=b.id JOIN public.tarefas n ON n.id=b.copia_nova_id
  WHERE o.coordenacao_id IS DISTINCT FROM n.coordenacao_id OR o.processo_id IS DISTINCT FROM n.processo_id
), u AS (
  UPDATE public.tarefas t SET observacoes=e.observacoes FROM errados e WHERE t.id=e.id RETURNING t.id
)
DELETE FROM public.etiquetas_itens i USING public.etiquetas et
WHERE et.id=i.etiqueta_id AND et.nome='DUPLICADA – MANTIDA POR SEGURANÇA' AND i.entidade_id IN (SELECT id FROM u);

DELETE FROM public.etiquetas et WHERE et.nome='DUPLICADA – MANTIDA POR SEGURANÇA'
AND NOT EXISTS (SELECT 1 FROM public.etiquetas_itens i WHERE i.etiqueta_id=et.id);