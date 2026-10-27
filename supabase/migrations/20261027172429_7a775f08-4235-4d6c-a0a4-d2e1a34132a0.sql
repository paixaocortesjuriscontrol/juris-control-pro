CREATE OR REPLACE FUNCTION public.recuperar_complementos_projuris(_migracao_id uuid, _fontes jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  mig public.migracoes_projuris%ROWTYPE;
  fonte jsonb; atual public.processos%ROWTYPE; qtd integer; campo text; valor jsonb;
  campos jsonb; anteriores jsonb; conflitos jsonb; total integer := 0; ambiguos integer := 0; ausentes integer := 0;
  permitidos constant text[] := ARRAY['descricao','observacoes_processo','assunto','pasta_fisica','pasta_cliente','data_distribuicao','data_citacao','data_recebimento','data_arquivamento','valor_causa','valor_provisionado','valor_condenacao'];
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN RAISE EXCEPTION 'Somente administradores podem recuperar complementos'; END IF;
  SELECT * INTO mig FROM public.migracoes_projuris WHERE id=_migracao_id;
  IF NOT FOUND OR mig.criado_por <> auth.uid() OR mig.mapeamento->>'modulo' <> 'recuperacao_complementos' OR mig.status <> 'em_andamento' THEN RAISE EXCEPTION 'Lote de recuperação inválido'; END IF;
  IF jsonb_typeof(_fontes) <> 'array' OR jsonb_array_length(_fontes)>200 THEN RAISE EXCEPTION 'Lote deve conter até 200 fontes'; END IF;
  FOR fonte IN SELECT value FROM jsonb_array_elements(_fontes) LOOP
    IF coalesce(fonte->>'cnj','') !~ '^[0-9]{20}$' OR jsonb_typeof(fonte->'campos') IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Fonte inválida'; END IF;
    SELECT count(*) INTO qtd FROM public.processos p WHERE regexp_replace(p.numero,'[^0-9]','','g')=fonte->>'cnj';
    IF qtd<>1 THEN IF qtd=0 THEN ausentes:=ausentes+1; ELSE ambiguos:=ambiguos+1; END IF; CONTINUE; END IF;
    SELECT * INTO atual FROM public.processos p WHERE regexp_replace(p.numero,'[^0-9]','','g')=fonte->>'cnj' FOR UPDATE;
    IF NOT EXISTS (SELECT 1 FROM public.migracoes_projuris_itens i JOIN public.migracoes_projuris m ON m.id=i.migracao_id WHERE i.registro_id=atual.id AND i.tipo='processo' AND i.status IN ('criado','existente') AND m.coordenacao_id=mig.coordenacao_id) THEN ausentes:=ausentes+1; CONTINUE; END IF;
    IF EXISTS (SELECT 1 FROM public.migracoes_projuris_itens i WHERE i.migracao_id=_migracao_id AND i.registro_id=atual.id AND i.tipo='recuperacao_complemento') THEN CONTINUE; END IF;
    campos:='{}'; anteriores:='{}'; conflitos:='{}';
    FOR campo,valor IN SELECT key,value FROM jsonb_each(fonte->'campos') LOOP
      IF NOT campo=ANY(permitidos) OR jsonb_typeof(valor) NOT IN ('string','number') THEN RAISE EXCEPTION 'Campo de recuperação inválido: %',campo; END IF;
      IF nullif(btrim(valor #>> '{}'),'') IS NULL THEN CONTINUE; END IF;
      IF nullif(btrim(to_jsonb(atual)->>campo),'') IS NULL THEN
        campos:=campos || jsonb_build_object(campo,valor); anteriores:=anteriores || jsonb_build_object(campo,to_jsonb(atual)->campo);
      ELSIF btrim(to_jsonb(atual)->>campo) <> btrim(valor #>> '{}') THEN conflitos:=conflitos || jsonb_build_object(campo,jsonb_build_object('atual',to_jsonb(atual)->campo,'origem',valor)); END IF;
    END LOOP;
    FOR campo,valor IN SELECT key,value FROM jsonb_each(campos) LOOP
      EXECUTE format('UPDATE public.processos SET %1$I=(jsonb_populate_record(NULL::public.processos,$1)).%1$I WHERE id=$2',campo) USING jsonb_build_object(campo,valor),atual.id;
    END LOOP;
    INSERT INTO public.migracoes_projuris_itens(migracao_id,tipo,chave_externa,registro_id,status,motivo,dados) VALUES (_migracao_id,'recuperacao_complemento',fonte->>'cd',atual.id,CASE WHEN campos<>'{}' THEN 'recuperado' ELSE 'preservado' END,'Complementos do backup; valores preenchidos preservados',jsonb_build_object('cnj',fonte->>'cnj','anterior',anteriores,'recuperado',campos,'conflitos',conflitos,'origem','backup_projuris'));
    IF campos<>'{}' THEN total:=total+1; END IF;
  END LOOP;
  RETURN jsonb_build_object('recuperados',total,'ambiguos',ambiguos,'ausentes',ausentes);
END; $$;
REVOKE ALL ON FUNCTION public.recuperar_complementos_projuris(uuid,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.recuperar_complementos_projuris(uuid,jsonb) TO authenticated;
GRANT ALL ON FUNCTION public.recuperar_complementos_projuris(uuid,jsonb) TO service_role;