CREATE OR REPLACE FUNCTION public.importar_comentarios_projuris(_migracao uuid, _itens jsonb, _corte date)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE r jsonb; _t uuid; _autor uuid; _id uuid; _dt timestamptz;
  _criados int:=0; _ja int:=0; _sem int:=0; _corte_n int:=0;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin'::app_role) THEN RAISE EXCEPTION 'Somente administradores'; END IF;
  PERFORM set_config('app.sem_notificacao','1',true);
  FOR r IN SELECT * FROM jsonb_array_elements(_itens) LOOP
    _dt := (r->>'criado_em')::timestamp AT TIME ZONE 'America/Sao_Paulo';
    IF _corte IS NOT NULL AND (_dt AT TIME ZONE 'America/Sao_Paulo')::date > _corte THEN _corte_n:=_corte_n+1; CONTINUE; END IF;
    IF EXISTS (SELECT 1 FROM migracoes_projuris_itens WHERE tipo='comentario' AND chave_externa=r->>'cd' AND status='criado') THEN _ja:=_ja+1; CONTINUE; END IF;
    _t := NULL;
    SELECT i.registro_id INTO _t FROM migracoes_projuris_itens i JOIN tarefas t ON t.id=i.registro_id
      WHERE i.tipo='tarefa' AND i.status='criado' AND i.chave_externa=r->>'tarefa' ORDER BY i.created_at DESC LIMIT 1;
    IF _t IS NULL THEN _sem:=_sem+1; CONTINUE; END IF;
    _autor := NULL;
    IF coalesce(r->>'autor','')<>'' THEN
      SELECT p.id INTO _autor FROM profiles p
       WHERE lower(unaccent_safe(trim(p.nome))) = lower(unaccent_safe(trim(r->>'autor'))) LIMIT 1;
    END IF;
    INSERT INTO comentarios_tarefas(tarefa_id, autor_id, conteudo, created_at, mencionados, is_cobranca)
    VALUES (_t, coalesce(_autor, auth.uid()),
      CASE WHEN _autor IS NULL AND coalesce(r->>'autor','')<>'' THEN '['||(r->>'autor')||' – Projuris] ' ELSE '' END || (r->>'conteudo'),
      _dt, '{}', false) RETURNING id INTO _id;
    INSERT INTO migracoes_projuris_itens(migracao_id,tipo,chave_externa,registro_id,status) VALUES (_migracao,'comentario',r->>'cd',_id,'criado');
    _criados:=_criados+1;
  END LOOP;
  RETURN jsonb_build_object('criados',_criados,'ja_importados',_ja,'sem_tarefa',_sem,'apos_corte',_corte_n);
END $$;