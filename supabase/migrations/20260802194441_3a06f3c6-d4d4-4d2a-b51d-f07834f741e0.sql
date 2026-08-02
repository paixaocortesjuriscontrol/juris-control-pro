CREATE OR REPLACE FUNCTION public.prevent_duplicate_tarefas()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  existing_id UUID;
BEGIN
  IF NEW.origem IS NULL THEN
    RETURN NEW;
  END IF;

  -- Importações são deduplicadas na própria planilha / pelo identificador
  IF NEW.origem IN ('astrea','projuris','pauta_excel','importacao','planilha') THEN
    RETURN NEW;
  END IF;

  SELECT id INTO existing_id
  FROM tarefas
  WHERE
    LOWER(TRIM(titulo)) = LOWER(TRIM(NEW.titulo))
    AND COALESCE(data_vencimento, data_fatal) = COALESCE(NEW.data_vencimento, NEW.data_fatal)
    AND COALESCE(processo_id::text, '') = COALESCE(NEW.processo_id::text, '')
    AND COALESCE(responsavel_id::text, '') = COALESCE(NEW.responsavel_id::text, '')
    AND COALESCE(tipo_tarefa, '') = COALESCE(NEW.tipo_tarefa, '')
    AND created_at >= NOW() - INTERVAL '60 days'
  LIMIT 1;

  IF existing_id IS NOT NULL THEN
    RAISE EXCEPTION 'Tarefa duplicada detectada. Já existe uma tarefa similar (ID: %) com mesmo título, data, processo, responsável e tipo.', existing_id
      USING ERRCODE = 'unique_violation';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enqueue_criacao_item()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _entidade TEXT := TG_ARGV[0];
  _titulo TEXT;
  _coord UUID;
  _status TEXT;
  _resp UUID[];
  _ator UUID;
  _origem TEXT;
BEGIN
  -- Não notificar itens criados por importação em massa
  BEGIN EXECUTE 'SELECT ($1).origem::TEXT' INTO _origem USING NEW; EXCEPTION WHEN OTHERS THEN _origem := NULL; END;
  IF _origem IS NOT NULL AND _origem IN ('astrea','projuris','pauta_excel','importacao','planilha') THEN
    RETURN NEW;
  END IF;

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
$$;