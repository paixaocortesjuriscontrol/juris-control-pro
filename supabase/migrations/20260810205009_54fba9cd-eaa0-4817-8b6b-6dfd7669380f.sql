ALTER TABLE public.comentarios_tarefas ADD COLUMN IF NOT EXISTS mencionados uuid[] NOT NULL DEFAULT '{}'::uuid[];
ALTER TABLE public.comentarios_eventos ADD COLUMN IF NOT EXISTS mencionados uuid[] NOT NULL DEFAULT '{}'::uuid[];
ALTER TABLE public.comentarios_audiencias ADD COLUMN IF NOT EXISTS mencionados uuid[] NOT NULL DEFAULT '{}'::uuid[];

UPDATE public.config_alertas_coordenacao
SET tipos_alerta = array_append(COALESCE(tipos_alerta, ARRAY[]::text[]), 'mencao')
WHERE NOT ('mencao' = ANY(COALESCE(tipos_alerta, ARRAY[]::text[])));

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
  _menc UUID[];
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

  _menc := ARRAY(
    SELECT DISTINCT u FROM unnest(COALESCE(NEW.mencionados, ARRAY[]::uuid[])) AS u
    WHERE u IS NOT NULL AND u <> NEW.autor_id
  );

  _resp := public.resolver_destinatarios_comentario(_entidade, _item);
  _resp := ARRAY(
    SELECT DISTINCT u FROM unnest(_resp) AS u
    WHERE u IS NOT NULL AND u <> NEW.autor_id AND NOT (u = ANY(_menc))
  );

  IF COALESCE(array_length(_menc, 1), 0) > 0 THEN
    INSERT INTO public.notificacoes_fila (
      tipo_evento, entidade, entidade_id, coordenacao_id, titulo, responsaveis, contexto
    ) VALUES (
      'mencao', _entidade, _item, _coord, _titulo, _menc,
      jsonb_build_object('alterado_por', NEW.autor_id, 'alterado_em', now(), 'conteudo', NEW.conteudo)
    );
  END IF;

  IF COALESCE(array_length(_resp, 1), 0) > 0 THEN
    INSERT INTO public.notificacoes_fila (
      tipo_evento, entidade, entidade_id, coordenacao_id, titulo, responsaveis, contexto
    ) VALUES (
      'comentario', _entidade, _item, _coord, _titulo, _resp,
      jsonb_build_object('alterado_por', NEW.autor_id, 'alterado_em', now(), 'conteudo', NEW.conteudo)
    );
  END IF;

  RETURN NEW;
END;
$$;