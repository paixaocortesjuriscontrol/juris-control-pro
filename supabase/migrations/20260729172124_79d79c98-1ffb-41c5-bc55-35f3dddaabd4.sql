-- 1) Ativar tipo 'comentario' por padrão nas configs existentes
UPDATE public.config_alertas_coordenacao
SET tipos_alerta = array_append(COALESCE(tipos_alerta, ARRAY[]::text[]), 'comentario')
WHERE NOT ('comentario' = ANY(COALESCE(tipos_alerta, ARRAY[]::text[])));

-- 2) Resolver responsáveis + envolvidos de um item
CREATE OR REPLACE FUNCTION public.resolver_destinatarios_comentario(_entidade text, _entidade_id uuid)
RETURNS uuid[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  ids UUID[] := ARRAY[]::UUID[];
BEGIN
  IF _entidade = 'tarefa' THEN
    SELECT COALESCE(ARRAY_AGG(DISTINCT uid) FILTER (WHERE uid IS NOT NULL), ARRAY[]::UUID[]) INTO ids
    FROM (
      SELECT usuario_id AS uid FROM public.tarefa_responsaveis WHERE tarefa_id = _entidade_id
      UNION SELECT usuario_id FROM public.tarefa_envolvidos WHERE tarefa_id = _entidade_id
      UNION SELECT responsavel_id FROM public.tarefas WHERE id = _entidade_id
      UNION SELECT criado_por FROM public.tarefas WHERE id = _entidade_id
    ) t;
  ELSIF _entidade = 'evento' THEN
    SELECT COALESCE(ARRAY_AGG(DISTINCT uid) FILTER (WHERE uid IS NOT NULL), ARRAY[]::UUID[]) INTO ids
    FROM (
      SELECT usuario_id AS uid FROM public.evento_responsaveis WHERE evento_id = _entidade_id
      UNION SELECT usuario_id FROM public.evento_envolvidos WHERE evento_id = _entidade_id
      UNION SELECT criado_por FROM public.eventos_agenda WHERE id = _entidade_id
    ) t;
  ELSIF _entidade = 'audiencia' THEN
    SELECT COALESCE(ARRAY_AGG(DISTINCT uid) FILTER (WHERE uid IS NOT NULL), ARRAY[]::UUID[]) INTO ids
    FROM (
      SELECT usuario_id AS uid FROM public.audiencia_envolvidos WHERE audiencia_id = _entidade_id
      UNION SELECT usuario_id FROM public.audiencias_advogados WHERE audiencia_id = _entidade_id
      UNION SELECT criado_por FROM public.audiencias_detectadas WHERE id = _entidade_id
    ) t;
  END IF;
  RETURN COALESCE(ids, ARRAY[]::UUID[]);
END;
$$;

-- 3) Trigger de enfileiramento de comentários
CREATE OR REPLACE FUNCTION public.enqueue_comentario()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _entidade TEXT := TG_ARGV[0];
  _fk TEXT := TG_ARGV[1];
  _item UUID;
  _titulo TEXT;
  _coord UUID;
  _resp UUID[];
BEGIN
  EXECUTE format('SELECT ($1).%I::UUID', _fk) INTO _item USING NEW;
  IF _item IS NULL THEN RETURN NEW; END IF;

  IF _entidade = 'tarefa' THEN
    SELECT titulo, coordenacao_id INTO _titulo, _coord FROM public.tarefas WHERE id = _item;
  ELSIF _entidade = 'evento' THEN
    SELECT titulo, coordenacao_id INTO _titulo, _coord FROM public.eventos_agenda WHERE id = _item;
  ELSIF _entidade = 'audiencia' THEN
    SELECT COALESCE(tipo_audiencia, 'Audiência'), coordenacao_id INTO _titulo, _coord
    FROM public.audiencias_detectadas WHERE id = _item;
  END IF;

  _resp := public.resolver_destinatarios_comentario(_entidade, _item);
  _resp := ARRAY(SELECT DISTINCT u FROM unnest(_resp) AS u WHERE u IS NOT NULL AND u <> NEW.autor_id);
  IF COALESCE(array_length(_resp, 1), 0) = 0 THEN RETURN NEW; END IF;

  INSERT INTO public.notificacoes_fila (
    tipo_evento, entidade, entidade_id, coordenacao_id, titulo, responsaveis, contexto
  ) VALUES (
    'comentario', _entidade, _item, _coord, _titulo, _resp,
    jsonb_build_object('alterado_por', NEW.autor_id, 'alterado_em', now(), 'conteudo', NEW.conteudo)
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_comentario_tarefa ON public.comentarios_tarefas;
CREATE TRIGGER trg_comentario_tarefa AFTER INSERT ON public.comentarios_tarefas
FOR EACH ROW EXECUTE FUNCTION public.enqueue_comentario('tarefa', 'tarefa_id');

DROP TRIGGER IF EXISTS trg_comentario_evento ON public.comentarios_eventos;
CREATE TRIGGER trg_comentario_evento AFTER INSERT ON public.comentarios_eventos
FOR EACH ROW EXECUTE FUNCTION public.enqueue_comentario('evento', 'evento_id');

DROP TRIGGER IF EXISTS trg_comentario_audiencia ON public.comentarios_audiencias;
CREATE TRIGGER trg_comentario_audiencia AFTER INSERT ON public.comentarios_audiencias
FOR EACH ROW EXECUTE FUNCTION public.enqueue_comentario('audiencia', 'audiencia_id');