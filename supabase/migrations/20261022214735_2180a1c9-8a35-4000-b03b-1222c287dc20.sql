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
 -- Regravações da lista em chamadas sucessivas não devem duplicar o aviso.
 PERFORM pg_advisory_xact_lock(hashtextextended(_tarefa.id::text||':'||_usuario::text,0));
 IF EXISTS(SELECT 1 FROM public.notificacoes WHERE usuario_id=_usuario AND dados->>'evento'='novo_responsavel' AND dados->>'entidade_id'=_tarefa.id::text AND created_at>=clock_timestamp()-interval '1 minute') THEN RETURN NEW; END IF;
 SELECT nome INTO _coord_nome FROM public.coordenacoes WHERE id=_tarefa.coordenacao_id;
 INSERT INTO public.notificacoes(usuario_id,titulo,mensagem,tipo,lida,link,dados)
 VALUES(_usuario,'Você foi incluído como responsável — '||_tarefa.titulo,
 'Você foi incluído como responsável pela tarefa “'||_tarefa.titulo||'”.'||CASE WHEN _coord_nome IS NOT NULL THEN E'\nCoordenação: '||_coord_nome ELSE '' END,
 'info',false,'/painel-controle?itemId='||_tarefa.id,
 jsonb_build_object('evento','novo_responsavel','entidade','tarefa','entidade_id',_tarefa.id,'tarefa_id',_tarefa.id,'coordenacao_id',_tarefa.coordenacao_id,'alterado_por',_ator,'alterado_em',now()));
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.notificar_novo_responsavel_tarefa() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER trg_notif_novo_responsavel_tarefa AFTER UPDATE OF responsavel_id ON public.tarefas FOR EACH ROW EXECUTE FUNCTION public.notificar_novo_responsavel_tarefa();
CREATE TRIGGER trg_notif_novo_corresponsavel_tarefa AFTER INSERT ON public.tarefa_responsaveis FOR EACH ROW EXECUTE FUNCTION public.notificar_novo_responsavel_tarefa();
COMMIT;