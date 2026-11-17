CREATE OR REPLACE FUNCTION public.bloquear_configuracao_agendamento()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _tipo text; _t text; _novo jsonb; _velho jsonb; k text; _sem_rec boolean;
BEGIN
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;
  -- Etapas geradas automaticamente pelo workflow não dependem da permissão de quem concluiu a etapa anterior
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
    IF _novo->k IS DISTINCT FROM _velho->k
       AND k NOT IN ('status','updated_at','updated_by','motivo_cancelamento','observacao_status')
       AND k NOT LIKE '%\_em' AND k NOT LIKE '%\_por' AND k NOT LIKE '%conclu%' AND k NOT LIKE '%cumpri%' AND k NOT LIKE 'status\_%' THEN
      RAISE EXCEPTION 'Sua coordenação só permite mudar a situação deste agendamento.' USING ERRCODE='42501';
    END IF;
  END LOOP;
  RETURN NEW;
END $function$;