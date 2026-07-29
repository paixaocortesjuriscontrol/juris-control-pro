CREATE OR REPLACE FUNCTION public.enqueue_criacao_item()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _entidade TEXT := TG_ARGV[0];
  _titulo TEXT;
  _coord UUID;
  _status TEXT;
  _resp UUID[];
  _ator UUID;
BEGIN
  BEGIN EXECUTE 'SELECT ($1).titulo::TEXT' INTO _titulo USING NEW; EXCEPTION WHEN OTHERS THEN _titulo := NULL; END;
  IF _entidade = 'audiencia' THEN
    BEGIN EXECUTE 'SELECT ($1).tipo_audiencia::TEXT' INTO _titulo USING NEW; EXCEPTION WHEN OTHERS THEN NULL; END;
  END IF;
  BEGIN EXECUTE 'SELECT ($1).coordenacao_id::UUID' INTO _coord USING NEW; EXCEPTION WHEN OTHERS THEN _coord := NULL; END;
  BEGIN EXECUTE 'SELECT ($1).status::TEXT' INTO _status USING NEW; EXCEPTION WHEN OTHERS THEN _status := NULL; END;

  _resp := public.resolver_destinatarios_comentario(_entidade, NEW.id);
  BEGIN _ator := auth.uid(); EXCEPTION WHEN OTHERS THEN _ator := NULL; END;
  _resp := ARRAY(SELECT DISTINCT u FROM unnest(_resp) AS u WHERE u IS NOT NULL);
  IF COALESCE(array_length(_resp, 1), 0) = 0 THEN RETURN NEW; END IF;

  INSERT INTO public.notificacoes_fila (
    tipo_evento, entidade, entidade_id, coordenacao_id,
    status_anterior, status_novo, titulo, responsaveis, contexto
  ) VALUES (
    'mudanca_situacao', _entidade, NEW.id, _coord,
    'criado', COALESCE(_status, 'pendente'), COALESCE(_titulo, 'Novo item'), _resp,
    jsonb_build_object('alterado_por', _ator, 'alterado_em', now(), 'criacao', true)
  );
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_notif_criacao_tarefas ON public.tarefas;
CREATE TRIGGER trg_notif_criacao_tarefas
AFTER INSERT ON public.tarefas
FOR EACH ROW EXECUTE FUNCTION public.enqueue_criacao_item('tarefa');

DROP TRIGGER IF EXISTS trg_notif_criacao_eventos ON public.eventos_agenda;
CREATE TRIGGER trg_notif_criacao_eventos
AFTER INSERT ON public.eventos_agenda
FOR EACH ROW EXECUTE FUNCTION public.enqueue_criacao_item('evento');

DROP TRIGGER IF EXISTS trg_notif_criacao_audiencias ON public.audiencias_detectadas;
CREATE TRIGGER trg_notif_criacao_audiencias
AFTER INSERT ON public.audiencias_detectadas
FOR EACH ROW EXECUTE FUNCTION public.enqueue_criacao_item('audiencia');