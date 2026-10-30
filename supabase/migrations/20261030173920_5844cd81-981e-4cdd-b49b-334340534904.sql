CREATE OR REPLACE FUNCTION public.enqueue_alteracao_item()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _antes jsonb:=to_jsonb(OLD)-'updated_at'; _depois jsonb:=to_jsonb(NEW)-'updated_at'; _campos text[]; _extra uuid[]:='{}'::uuid[];
BEGIN
 IF coalesce(current_setting('app.sem_notificacao', true), '') = '1' THEN RETURN NEW; END IF;
 IF _antes IS NOT DISTINCT FROM _depois OR auth.uid() IS NULL THEN RETURN NEW; END IF;
 SELECT array_agg(key) INTO _campos FROM jsonb_each(_depois) WHERE value IS DISTINCT FROM _antes->key;
 IF TG_TABLE_NAME='tarefas' AND (_depois->>'responsavel_id') IS NOT NULL THEN _extra:=ARRAY[(_depois->>'responsavel_id')::uuid]; END IF;
 PERFORM public.enfileirar_aviso_item('alteracao',TG_ARGV[0],NEW.id,auth.uid(),jsonb_build_object('campos',_campos,'status_anterior',_antes->>'status','status_novo',_depois->>'status'),_extra);
 RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.corrigir_titulos_por_modelo_projuris(_coordenacao_id uuid, _limite integer DEFAULT 200)
RETURNS integer LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE n integer;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Apenas administradores'; END IF;
  -- Manutenção em massa: não enviar avisos de alteração aos responsáveis.
  PERFORM set_config('app.sem_notificacao', '1', true);
  WITH alvo AS (
    SELECT t.id, m.nome AS novo, t.titulo AS antigo
      FROM public.tarefas t JOIN public.modelos_titulo_coordenacao m ON m.id = t.modelo_tarefa_id
     WHERE t.coordenacao_id = _coordenacao_id AND t.origem = 'projuris'
       AND COALESCE(trim(m.nome), '') <> '' AND upper(trim(t.titulo)) IS DISTINCT FROM upper(trim(m.nome))
     LIMIT GREATEST(1, LEAST(_limite, 1000))
  )
  UPDATE public.tarefas t
     SET titulo = left(a.novo, 500),
         descricao = CASE
           WHEN COALESCE(trim(a.antigo), '') = '' THEN t.descricao
           WHEN t.descricao IS NULL OR trim(t.descricao) = '' THEN a.antigo
           WHEN position(a.antigo in t.descricao) > 0 THEN t.descricao
           ELSE a.antigo || E'\n' || t.descricao END
    FROM alvo a WHERE t.id = a.id;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.corrigir_titulos_por_modelo_projuris(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.corrigir_titulos_por_modelo_projuris(uuid, integer) TO authenticated;