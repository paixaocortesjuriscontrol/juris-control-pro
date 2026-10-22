-- Executar em transação: os dados de teste são sempre revertidos.
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