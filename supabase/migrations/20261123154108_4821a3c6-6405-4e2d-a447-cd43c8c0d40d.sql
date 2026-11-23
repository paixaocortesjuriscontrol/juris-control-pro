CREATE OR REPLACE FUNCTION public._agend_valor_norm(v jsonb)
RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE t text;
BEGIN
  IF v IS NULL OR jsonb_typeof(v) = 'null' THEN RETURN NULL; END IF;
  IF jsonb_typeof(v) IN ('object','array') THEN
    IF v = '{}'::jsonb OR v = '[]'::jsonb THEN RETURN NULL; END IF;
    RETURN v::text;
  END IF;
  t := nullif(btrim(v #>> '{}'), '');
  IF t IS NULL THEN RETURN NULL; END IF;
  IF t ~ '^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}' THEN
    BEGIN RETURN to_char(t::timestamptz AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS'); EXCEPTION WHEN others THEN RETURN t; END;
  END IF;
  IF t ~ '^\d{2}:\d{2}(:\d{2})?$' THEN RETURN left(t, 5); END IF;
  IF t ~ '^-?\d+(\.\d+)?$' THEN RETURN (t::numeric)::text; END IF;
  RETURN t;
END $$;

CREATE OR REPLACE FUNCTION public._agend_rotulo_campo(k text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE k
    WHEN 'titulo' THEN 'Título' WHEN 'descricao' THEN 'Descrição' WHEN 'observacoes' THEN 'Observações'
    WHEN 'observacao' THEN 'Observação' WHEN 'data_fatal' THEN 'Data fatal' WHEN 'data_limite' THEN 'Data limite'
    WHEN 'data_inicio' THEN 'Data de início' WHEN 'data_fim' THEN 'Data de fim' WHEN 'data_audiencia' THEN 'Data da audiência'
    WHEN 'hora' THEN 'Hora' WHEN 'hora_fatal' THEN 'Hora fatal' WHEN 'processo_id' THEN 'Processo'
    WHEN 'processo_numero' THEN 'Número do processo' WHEN 'tipo_tarefa' THEN 'Tipo' WHEN 'prioridade' THEN 'Prioridade'
    WHEN 'local' THEN 'Local' WHEN 'responsavel_id' THEN 'Responsável' WHEN 'coordenacao_id' THEN 'Coordenação'
    WHEN 'tipo_audiencia' THEN 'Tipo da audiência' WHEN 'modalidade' THEN 'Modalidade'
    ELSE k END
$$;

CREATE OR REPLACE FUNCTION public.bloquear_configuracao_agendamento()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _tipo text; _t text; _novo jsonb; _velho jsonb; k text; _sem_rec boolean;
  _revert jsonb := '{}'::jsonb;
  _derivados text[] := ARRAY['data_base','prazo_dias','prazo_unidade','tipo_registro','hora_local','hora_brasilia'];
BEGIN
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;
  IF TG_OP='INSERT' AND (to_jsonb(NEW)->>'origem') = 'workflow' THEN RETURN NEW; END IF;
  IF TG_TABLE_NAME='audiencias_detectadas' THEN _tipo:='audiencia';
  ELSIF TG_TABLE_NAME='eventos_agenda' THEN _tipo:='evento';
  ELSE
    _t := upper(coalesce(NEW.tipo_tarefa,''));
    IF _t LIKE 'AUDI%' THEN _tipo:='audiencia';
    ELSIF _t='EVENTO' THEN _tipo:='evento';
    ELSIF _t LIKE 'PRAZO%' OR (to_jsonb(NEW)->>'data_fatal') IS NOT NULL THEN _tipo:='prazo';
    ELSE _tipo:='tarefa'; END IF;
  END IF;
  IF public.pode_configurar_agendamento(auth.uid(), NEW.coordenacao_id, _tipo) THEN RETURN NEW; END IF;
  IF TG_OP='INSERT' THEN
    RAISE EXCEPTION 'Sua coordenação não permite que você crie este tipo de agendamento.' USING ERRCODE='42501';
  END IF;
  _novo := to_jsonb(NEW); _velho := to_jsonb(OLD);
  _sem_rec := coalesce((_novo->>'recorrente')::boolean,false) = false AND coalesce((_velho->>'recorrente')::boolean,false) = false;
  FOR k IN SELECT key FROM jsonb_each(_novo) LOOP
    IF _sem_rec AND k LIKE 'recorrencia%' THEN CONTINUE; END IF;
    IF k IN ('status','updated_at','updated_by','motivo_cancelamento','observacao_status')
       OR k LIKE '%\_em' OR k LIKE '%\_por' OR k LIKE '%conclu%' OR k LIKE '%cumpri%' OR k LIKE 'status\_%' THEN CONTINUE; END IF;
    IF public._agend_valor_norm(_novo->k) IS NOT DISTINCT FROM public._agend_valor_norm(_velho->k) THEN CONTINUE; END IF;
    -- Campos preenchidos automaticamente pelas telas: mantém o valor gravado em vez de bloquear
    IF k = ANY(_derivados) THEN _revert := _revert || jsonb_build_object(k, _velho->k); CONTINUE; END IF;
    RAISE EXCEPTION 'Sua coordenação só permite mudar a situação deste agendamento (campo alterado: %).', public._agend_rotulo_campo(k) USING ERRCODE='42501';
  END LOOP;
  IF _revert <> '{}'::jsonb THEN NEW := jsonb_populate_record(NEW, _revert); END IF;
  RETURN NEW;
END $function$;