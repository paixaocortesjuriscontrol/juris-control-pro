BEGIN;
CREATE OR REPLACE FUNCTION public.notificar_novo_responsavel_tarefa()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
 _tarefa public.tarefas%ROWTYPE;
 _usuario uuid;
 _ator uuid := auth.uid();
 _coord_nome text;
BEGIN
 IF _ator IS NULL THEN RETURN NEW; END IF;
 IF TG_TABLE_NAME='tarefas' THEN
   IF NEW.responsavel_id IS NULL OR NEW.responsavel_id IS NOT DISTINCT FROM OLD.responsavel_id THEN RETURN NEW; END IF;
   _tarefa := NEW; _usuario := NEW.responsavel_id;
   IF EXISTS(SELECT 1 FROM public.tarefa_responsaveis WHERE tarefa_id=NEW.id AND usuario_id=_usuario) THEN RETURN NEW; END IF;
 ELSE
   SELECT * INTO _tarefa FROM public.tarefas WHERE id=NEW.tarefa_id;
   _usuario := NEW.usuario_id;
   IF _tarefa.id IS NULL OR _usuario IS NULL THEN RETURN NEW; END IF;
   IF _usuario=_tarefa.responsavel_id THEN RETURN NEW; END IF;
 END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(_tarefa.id::text||':'||_usuario::text,0));
 IF EXISTS(SELECT 1 FROM public.notificacoes WHERE usuario_id=_usuario AND dados->>'evento'='novo_responsavel' AND dados->>'entidade_id'=_tarefa.id::text AND created_at>=clock_timestamp()-interval '1 minute') THEN RETURN NEW; END IF;
 SELECT nome INTO _coord_nome FROM public.coordenacoes WHERE id=_tarefa.coordenacao_id;
 INSERT INTO public.notificacoes(usuario_id,titulo,mensagem,tipo,lida,link,dados)
 VALUES(_usuario,'Você foi incluído como responsável — '||_tarefa.titulo,
 'Você foi incluído como responsável pela tarefa “'||_tarefa.titulo||'”.'||CASE WHEN _coord_nome IS NOT NULL THEN E'\nCoordenação: '||_coord_nome ELSE '' END,
 'info',false,'/painel-controle?item='||_tarefa.id,
 jsonb_build_object('evento','novo_responsavel','entidade','tarefa','entidade_id',_tarefa.id,'tarefa_id',_tarefa.id,'coordenacao_id',_tarefa.coordenacao_id,'alterado_por',_ator,'alterado_em',now()));
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.notificar_novo_responsavel_tarefa() FROM PUBLIC,anon,authenticated;
COMMIT;
BEGIN;
DO $$
DECLARE
 ator uuid;
 usuario uuid;
 tarefa uuid := gen_random_uuid();
 quantidade integer;
BEGIN
 SELECT user_id INTO ator FROM public.user_roles WHERE role='admin' LIMIT 1;
 SELECT id INTO usuario FROM public.profiles WHERE id<>ator LIMIT 1;
 IF ator IS NULL OR usuario IS NULL THEN RAISE EXCEPTION 'Teste exige administrador e outro perfil'; END IF;
 PERFORM set_config('request.jwt.claim.sub',ator::text,true);
 INSERT INTO public.tarefas(id,titulo,origem,criado_por) VALUES(tarefa,'Teste transacional de atribuição '||tarefa,'importacao',ator);
 INSERT INTO public.tarefa_responsaveis(tarefa_id,usuario_id) VALUES(tarefa,usuario);
 SELECT count(*) INTO quantidade FROM public.notificacoes WHERE usuario_id=usuario AND dados->>'entidade_id'=tarefa::text AND dados->>'evento'='novo_responsavel';
 IF quantidade<>1 THEN RAISE EXCEPTION 'Inclusão de corresponsável deve gerar exatamente um aviso'; END IF;
 UPDATE public.tarefas SET responsavel_id=usuario WHERE id=tarefa;
 SELECT count(*) INTO quantidade FROM public.notificacoes WHERE usuario_id=usuario AND dados->>'entidade_id'=tarefa::text AND dados->>'evento'='novo_responsavel';
 IF quantidade<>1 THEN RAISE EXCEPTION 'Responsável já incluído não deve gerar aviso repetido'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.notificacoes WHERE usuario_id=usuario AND dados->>'entidade_id'=tarefa::text AND link='/painel-controle?item='||tarefa AND lida=false) THEN RAISE EXCEPTION 'Aviso deve abrir a tarefa e iniciar não lido'; END IF;
 UPDATE public.tarefas SET responsavel_id=ator WHERE id=tarefa;
 IF NOT EXISTS(SELECT 1 FROM public.notificacoes WHERE usuario_id=ator AND dados->>'entidade_id'=tarefa::text AND dados->>'evento'='novo_responsavel') THEN RAISE EXCEPTION 'Troca de responsável deve avisar o novo responsável'; END IF;
 PERFORM set_config('request.jwt.claim.sub','',true);
 INSERT INTO public.tarefa_responsaveis(tarefa_id,usuario_id) VALUES(tarefa,ator);
 SELECT count(*) INTO quantidade FROM public.notificacoes WHERE dados->>'entidade_id'=tarefa::text AND dados->>'evento'='novo_responsavel';
 IF quantidade<>2 THEN RAISE EXCEPTION 'Operação sem sessão não deve gerar aviso'; END IF;
END $$;
ROLLBACK;