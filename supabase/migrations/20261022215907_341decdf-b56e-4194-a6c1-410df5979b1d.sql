-- Executar em transação: os dados de teste são sempre revertidos.
CREATE OR REPLACE FUNCTION public.enqueue_alteracao_item() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $f$
DECLARE _antes jsonb:=to_jsonb(OLD)-'updated_at'; _depois jsonb:=to_jsonb(NEW)-'updated_at'; _campos text[]; _extra uuid[]:='{}'::uuid[];
BEGIN
 IF _antes IS NOT DISTINCT FROM _depois OR auth.uid() IS NULL THEN RETURN NEW; END IF;
 SELECT array_agg(key) INTO _campos FROM jsonb_each(_depois) WHERE value IS DISTINCT FROM _antes->key;
 IF _depois->>'responsavel_id' IS NOT NULL THEN _extra:=ARRAY[(_depois->>'responsavel_id')::uuid]; END IF;
 PERFORM public.enfileirar_aviso_item('alteracao',TG_ARGV[0],NEW.id,auth.uid(),jsonb_build_object('campos',_campos,'status_anterior',_antes->>'status','status_novo',_depois->>'status'),_extra);
 RETURN NEW;
END $f$;
BEGIN;
DO $$
DECLARE
 ator uuid;
 usuario uuid;
 tarefa uuid := gen_random_uuid();
 evento uuid := gen_random_uuid();
 audiencia uuid := gen_random_uuid();
 parcela uuid := gen_random_uuid();
 comentario uuid := gen_random_uuid();
 quantidade integer;
 tipo text;
 dados_item record;
BEGIN
 SELECT user_id INTO ator FROM public.user_roles WHERE role='admin' LIMIT 1;
 SELECT id INTO usuario FROM public.profiles WHERE id<>ator LIMIT 1;
 IF ator IS NULL OR usuario IS NULL THEN RAISE EXCEPTION 'Teste exige administrador e outro perfil'; END IF;
 PERFORM set_config('request.jwt.claim.sub',ator::text,true);
 FOREACH tipo IN ARRAY ARRAY['TAREFA','PRAZO','ATA'] LOOP
   tarefa:=gen_random_uuid();
   INSERT INTO public.tarefas(id,titulo,origem,criado_por,tipo_tarefa) VALUES(tarefa,'Teste aviso '||tarefa,'importacao',ator,tipo);
   INSERT INTO public.tarefa_envolvidos(tarefa_id,usuario_id) VALUES(tarefa,usuario);
   IF NOT EXISTS(SELECT 1 FROM public.notificacoes_fila WHERE entidade_id=tarefa AND tipo_evento='participante_incluido' AND usuario=ANY(responsaveis) AND ator=ANY(responsaveis)) THEN RAISE EXCEPTION 'Inclusão de envolvido deve avisar envolvido e autor, tipo %',tipo; END IF;
   UPDATE public.tarefas SET responsavel_id=usuario WHERE id=tarefa;
   IF NOT EXISTS(SELECT 1 FROM public.notificacoes_fila WHERE entidade_id=tarefa AND usuario=ANY(responsaveis) AND ator=ANY(responsaveis)) THEN RAISE EXCEPTION 'Troca de responsável deve avisar destinatário e autor'; END IF;
   UPDATE public.tarefas SET descricao='Alteração real' WHERE id=tarefa;
   SELECT count(*) INTO quantidade FROM public.notificacoes_fila WHERE entidade_id=tarefa;
   UPDATE public.tarefas SET descricao='Alteração real' WHERE id=tarefa;
   IF (SELECT count(*) FROM public.notificacoes_fila WHERE entidade_id=tarefa)<>quantidade THEN RAISE EXCEPTION 'Salvar sem mudança não deve notificar'; END IF;
 END LOOP;
 INSERT INTO public.eventos_agenda(id,titulo,data_inicio,criado_por,origem) VALUES(evento,'Teste evento '||evento,now(),ator,'importacao');
 INSERT INTO public.evento_responsaveis(evento_id,usuario_id) VALUES(evento,usuario);
 INSERT INTO public.evento_envolvidos(evento_id,usuario_id) VALUES(evento,ator);
 INSERT INTO public.audiencias_detectadas(id,titulo,origem,criado_por) VALUES(audiencia,'Teste audiência '||audiencia,'manual',ator);
 INSERT INTO public.audiencias_advogados(audiencia_id,advogado_id) VALUES(audiencia,usuario);
 INSERT INTO public.audiencia_envolvidos(audiencia_id,usuario_id) VALUES(audiencia,ator);
 INSERT INTO public.parcelas_evento(id,evento_id,numero,data_vencimento) VALUES(parcela,evento,1,current_date);
 UPDATE public.eventos_agenda SET descricao='Alteração real' WHERE id=evento;
 UPDATE public.audiencias_detectadas SET observacoes='Alteração real' WHERE id=audiencia;
 UPDATE public.parcelas_evento SET observacoes='Alteração real' WHERE id=parcela;
 FOR dados_item IN SELECT * FROM (VALUES(evento,'evento'),(audiencia,'audiencia'),(parcela,'parcela')) v(id,entidade) LOOP
   IF NOT EXISTS(SELECT 1 FROM public.notificacoes_fila WHERE entidade_id=dados_item.id AND entidade=dados_item.entidade AND tipo_evento='alteracao' AND usuario=ANY(responsaveis) AND ator=ANY(responsaveis)) THEN RAISE EXCEPTION 'Alteração deve incluir responsável e autor em %',dados_item.entidade; END IF;
 END LOOP;
 INSERT INTO public.item_cobrancas(tipo_item,item_id,usuario_id) VALUES('prazo',tarefa,ator);
 IF NOT EXISTS(SELECT 1 FROM public.notificacoes_fila WHERE entidade_id=tarefa AND tipo_evento='cobranca' AND usuario=ANY(responsaveis) AND ator=ANY(responsaveis)) THEN RAISE EXCEPTION 'Bolinha C deve notificar destinatário e autor'; END IF;
 INSERT INTO public.comentarios_tarefas(id,tarefa_id,autor_id,conteudo,is_cobranca) VALUES(comentario,tarefa,ator,'Cobrança teste',true);
 SELECT count(*) INTO quantidade FROM public.notificacoes_fila WHERE entidade_id=tarefa AND tipo_evento='cobranca';
 INSERT INTO public.item_cobrancas(tipo_item,item_id,usuario_id,comentario_id) VALUES('tarefa',tarefa,ator,comentario);
 IF (SELECT count(*) FROM public.notificacoes_fila WHERE entidade_id=tarefa AND tipo_evento='cobranca')<>quantidade THEN RAISE EXCEPTION 'Comentário e bolinha da mesma cobrança não devem duplicar'; END IF;
 PERFORM set_config('request.jwt.claim.sub','',true);
 SELECT count(*) INTO quantidade FROM public.notificacoes_fila WHERE entidade_id=tarefa;
 UPDATE public.tarefas SET descricao='Manutenção sem sessão' WHERE id=tarefa;
 IF (SELECT count(*) FROM public.notificacoes_fila WHERE entidade_id=tarefa)<>quantidade THEN RAISE EXCEPTION 'Manutenção sem sessão não deve notificar'; END IF;
END $$;
ROLLBACK;