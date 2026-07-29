CREATE OR REPLACE FUNCTION public.enqueue_mudanca_situacao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _entidade TEXT := TG_ARGV[0];
  _status_col TEXT := COALESCE(TG_ARGV[1], 'status');
  _status_ant TEXT;
  _status_novo TEXT;
  _titulo TEXT;
  _coord UUID;
  _resp UUID[];
  _ator UUID;
  _contexto JSONB;
BEGIN
  EXECUTE format('SELECT ($1).%I::TEXT, ($2).%I::TEXT', _status_col, _status_col)
    INTO _status_ant, _status_novo
    USING OLD, NEW;

  IF _status_ant IS NOT DISTINCT FROM _status_novo THEN
    RETURN NEW;
  END IF;

  BEGIN
    EXECUTE 'SELECT ($1).titulo::TEXT' INTO _titulo USING NEW;
  EXCEPTION WHEN OTHERS THEN _titulo := NULL; END;

  IF _entidade = 'audiencia' AND _titulo IS NULL THEN
    BEGIN EXECUTE 'SELECT ($1).tipo_audiencia::TEXT' INTO _titulo USING NEW; EXCEPTION WHEN OTHERS THEN NULL; END;
  END IF;

  BEGIN
    EXECUTE 'SELECT ($1).coordenacao_id::UUID' INTO _coord USING NEW;
  EXCEPTION WHEN OTHERS THEN _coord := NULL; END;

  -- Destinatários completos (responsáveis + envolvidos), mesma regra dos comentários
  BEGIN
    _resp := public.resolver_destinatarios_comentario(_entidade, NEW.id);
  EXCEPTION WHEN OTHERS THEN
    _resp := public.resolver_responsaveis_entidade(_entidade, NEW.id);
  END;

  IF COALESCE(array_length(_resp, 1), 0) = 0 THEN
    _resp := public.resolver_responsaveis_entidade(_entidade, NEW.id);
  END IF;

  _resp := ARRAY(SELECT DISTINCT u FROM unnest(COALESCE(_resp, ARRAY[]::UUID[])) AS u WHERE u IS NOT NULL);

  IF COALESCE(array_length(_resp, 1), 0) = 0 THEN
    RETURN NEW;
  END IF;

  BEGIN _ator := auth.uid(); EXCEPTION WHEN OTHERS THEN _ator := NULL; END;

  _contexto := jsonb_build_object(
    'alterado_por', _ator,
    'alterado_em', now(),
    'status_col', _status_col
  );

  INSERT INTO public.notificacoes_fila (
    tipo_evento, entidade, entidade_id, coordenacao_id,
    status_anterior, status_novo, titulo, responsaveis, contexto
  ) VALUES (
    'mudanca_situacao', _entidade, NEW.id, _coord,
    _status_ant, _status_novo, _titulo, _resp, _contexto
  );

  RETURN NEW;
END;
$$;