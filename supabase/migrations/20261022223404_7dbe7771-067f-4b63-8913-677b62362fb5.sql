CREATE OR REPLACE FUNCTION public.enqueue_alteracao_item()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _antes jsonb:=to_jsonb(OLD)-'updated_at'; _depois jsonb:=to_jsonb(NEW)-'updated_at'; _campos text[]; _extra uuid[]:='{}'::uuid[];
BEGIN
 IF _antes IS NOT DISTINCT FROM _depois OR auth.uid() IS NULL THEN RETURN NEW; END IF;
 SELECT array_agg(key) INTO _campos FROM jsonb_each(_depois) WHERE value IS DISTINCT FROM _antes->key;
 IF TG_TABLE_NAME='tarefas' AND (_depois->>'responsavel_id') IS NOT NULL THEN _extra:=ARRAY[(_depois->>'responsavel_id')::uuid]; END IF;
 PERFORM public.enfileirar_aviso_item('alteracao',TG_ARGV[0],NEW.id,auth.uid(),jsonb_build_object('campos',_campos,'status_anterior',_antes->>'status','status_novo',_depois->>'status'),_extra);
 RETURN NEW;
END $function$;