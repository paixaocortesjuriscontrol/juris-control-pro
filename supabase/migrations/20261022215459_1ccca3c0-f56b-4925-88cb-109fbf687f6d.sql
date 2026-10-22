BEGIN;
CREATE OR REPLACE FUNCTION public.enfileirar_aviso_item(_tipo text,_entidade text,_id uuid,_ator uuid,_contexto jsonb DEFAULT '{}'::jsonb,_extra uuid[] DEFAULT '{}'::uuid[]) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _coord uuid; _titulo text; _ids uuid[]; _evento uuid;
BEGIN
 IF _ator IS NULL THEN RETURN; END IF;
 IF _entidade='tarefa' THEN SELECT titulo,coordenacao_id INTO _titulo,_coord FROM public.tarefas WHERE id=_id;
 ELSIF _entidade='evento' THEN SELECT titulo,coordenacao_id INTO _titulo,_coord FROM public.eventos_agenda WHERE id=_id;
 ELSIF _entidade='audiencia' THEN SELECT coalesce(titulo,tipo_audiencia,'Audiência'),coordenacao_id INTO _titulo,_coord FROM public.audiencias_detectadas WHERE id=_id;
 ELSIF _entidade='parcela' THEN SELECT pe.evento_id,'Parcela '||pe.numero,e.coordenacao_id INTO _evento,_titulo,_coord FROM public.parcelas_evento pe JOIN public.eventos_agenda e ON e.id=pe.evento_id WHERE pe.id=_id;
 END IF;
 IF _titulo IS NULL THEN RETURN; END IF;
 _ids:=public.resolver_destinatarios_comentario(CASE WHEN _entidade='parcela' THEN 'evento' ELSE _entidade END,coalesce(_evento,_id));
 IF _entidade='evento' OR _entidade='parcela' THEN _ids:=_ids||ARRAY(SELECT usuario_id FROM public.participantes_evento WHERE evento_id=coalesce(_evento,_id)); END IF;
 IF _entidade='audiencia' THEN _ids:=_ids||ARRAY(SELECT advogado_id FROM public.audiencias_advogados WHERE audiencia_id=_id); END IF;
 _ids:=ARRAY(SELECT DISTINCT u FROM unnest(coalesce(_ids,'{}'::uuid[])||coalesce(_extra,'{}'::uuid[])||ARRAY[_ator]) u WHERE u IS NOT NULL);
 IF _tipo='participante_incluido' THEN
 PERFORM pg_advisory_xact_lock(hashtextextended(_id::text||coalesce(_contexto->>'usuario_id',''),0));
 IF EXISTS(SELECT 1 FROM public.notificacoes_fila WHERE entidade_id=_id AND tipo_evento=_tipo AND contexto->>'usuario_id'=_contexto->>'usuario_id' AND created_at>=clock_timestamp()-interval '1 minute') THEN RETURN; END IF;
 END IF;
 INSERT INTO public.notificacoes_fila(tipo_evento,entidade,entidade_id,coordenacao_id,titulo,responsaveis,contexto) VALUES(_tipo,_entidade,_id,_coord,_titulo,_ids,coalesce(_contexto,'{}'::jsonb)||jsonb_build_object('alterado_por',_ator,'alterado_em',now()));
END $$;
REVOKE ALL ON FUNCTION public.enfileirar_aviso_item(text,text,uuid,uuid,jsonb,uuid[]) FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.enqueue_alteracao_item() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _antes jsonb:=to_jsonb(OLD)-'updated_at'; _depois jsonb:=to_jsonb(NEW)-'updated_at'; _campos text[]; _extra uuid[]:='{}'::uuid[];
BEGIN
 IF _antes IS NOT DISTINCT FROM _depois OR auth.uid() IS NULL THEN RETURN NEW; END IF;
 SELECT array_agg(key) INTO _campos FROM jsonb_each(_depois) WHERE value IS DISTINCT FROM _antes->key;
 IF TG_TABLE_NAME='tarefas' AND NEW.responsavel_id IS NOT NULL THEN _extra:=ARRAY[NEW.responsavel_id]; END IF;
 PERFORM public.enfileirar_aviso_item('alteracao',TG_ARGV[0],NEW.id,auth.uid(),jsonb_build_object('campos',_campos,'status_anterior',_antes->>'status','status_novo',_depois->>'status'),_extra);
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.enqueue_alteracao_item() FROM PUBLIC,anon,authenticated;
DROP TRIGGER trg_notif_mudanca_tarefas ON public.tarefas;
DROP TRIGGER trg_notif_mudanca_eventos ON public.eventos_agenda;
DROP TRIGGER trg_notif_mudanca_audiencias ON public.audiencias_detectadas;
DROP TRIGGER trg_notif_mudanca_parcelas ON public.parcelas_evento;
DROP TRIGGER trg_notif_novo_responsavel_tarefa ON public.tarefas;
DROP TRIGGER trg_notif_novo_corresponsavel_tarefa ON public.tarefa_responsaveis;
CREATE TRIGGER trg_notif_mudanca_tarefas AFTER UPDATE ON public.tarefas FOR EACH ROW EXECUTE FUNCTION public.enqueue_alteracao_item('tarefa');
CREATE TRIGGER trg_notif_mudanca_eventos AFTER UPDATE ON public.eventos_agenda FOR EACH ROW EXECUTE FUNCTION public.enqueue_alteracao_item('evento');
CREATE TRIGGER trg_notif_mudanca_audiencias AFTER UPDATE ON public.audiencias_detectadas FOR EACH ROW EXECUTE FUNCTION public.enqueue_alteracao_item('audiencia');
CREATE TRIGGER trg_notif_mudanca_parcelas AFTER UPDATE ON public.parcelas_evento FOR EACH ROW EXECUTE FUNCTION public.enqueue_alteracao_item('parcela');
CREATE OR REPLACE FUNCTION public.enqueue_participante_item() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _j jsonb:=to_jsonb(NEW); _id uuid:=(_j->>TG_ARGV[1])::uuid; _u uuid:=(_j->>TG_ARGV[2])::uuid;
BEGIN
 PERFORM public.enfileirar_aviso_item('participante_incluido',TG_ARGV[0],_id,auth.uid(),jsonb_build_object('usuario_id',_u,'papel',TG_ARGV[3]),ARRAY[_u]); RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.enqueue_participante_item() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER trg_notif_participante AFTER INSERT ON public.tarefa_responsaveis FOR EACH ROW EXECUTE FUNCTION public.enqueue_participante_item('tarefa','tarefa_id','usuario_id','responsavel');
CREATE TRIGGER trg_notif_participante AFTER INSERT ON public.tarefa_envolvidos FOR EACH ROW EXECUTE FUNCTION public.enqueue_participante_item('tarefa','tarefa_id','usuario_id','envolvido');
CREATE TRIGGER trg_notif_participante AFTER INSERT ON public.evento_responsaveis FOR EACH ROW EXECUTE FUNCTION public.enqueue_participante_item('evento','evento_id','usuario_id','responsavel');
CREATE TRIGGER trg_notif_participante AFTER INSERT ON public.evento_envolvidos FOR EACH ROW EXECUTE FUNCTION public.enqueue_participante_item('evento','evento_id','usuario_id','envolvido');
CREATE TRIGGER trg_notif_participante AFTER INSERT ON public.participantes_evento FOR EACH ROW EXECUTE FUNCTION public.enqueue_participante_item('evento','evento_id','usuario_id','envolvido');
CREATE TRIGGER trg_notif_participante AFTER INSERT ON public.audiencias_advogados FOR EACH ROW EXECUTE FUNCTION public.enqueue_participante_item('audiencia','audiencia_id','advogado_id','responsavel');
CREATE TRIGGER trg_notif_participante AFTER INSERT ON public.audiencia_envolvidos FOR EACH ROW EXECUTE FUNCTION public.enqueue_participante_item('audiencia','audiencia_id','usuario_id','envolvido');
CREATE OR REPLACE FUNCTION public.enqueue_comentario() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _j jsonb:=to_jsonb(NEW); _id uuid:=(_j->>TG_ARGV[1])::uuid;
BEGIN
 PERFORM public.enfileirar_aviso_item(CASE WHEN coalesce(NEW.is_cobranca,false) THEN 'cobranca' ELSE 'comentario' END,TG_ARGV[0],_id,auth.uid(),jsonb_build_object('conteudo',NEW.conteudo,'comentario_id',NEW.id,'is_cobranca',NEW.is_cobranca),coalesce(NEW.mencionados,'{}'::uuid[]));
 RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION public.enqueue_cobranca_item() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _entidade text:=CASE WHEN NEW.tipo_item IN ('prazo','ata') THEN 'tarefa' WHEN NEW.tipo_item='parcelamento' THEN 'evento' ELSE NEW.tipo_item END;
BEGIN
 IF NEW.comentario_id IS NOT NULL THEN RETURN NEW; END IF;
 PERFORM public.enfileirar_aviso_item('cobranca',_entidade,NEW.item_id,auth.uid(),jsonb_build_object('cobranca_id',NEW.id,'conteudo','Cobrança registrada no item.','simbolo',NEW.simbolo)); RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.enqueue_cobranca_item() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER trg_notif_cobranca AFTER INSERT ON public.item_cobrancas FOR EACH ROW EXECUTE FUNCTION public.enqueue_cobranca_item();
COMMIT;