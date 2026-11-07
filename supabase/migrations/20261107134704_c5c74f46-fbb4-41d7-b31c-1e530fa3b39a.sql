CREATE OR REPLACE FUNCTION public.corrigir_status_tarefas_projuris(_coordenacao_id uuid, _itens jsonb)
 RETURNS integer
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE n integer;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Apenas administradores'; END IF;
  PERFORM set_config('app.sem_notificacao', '1', true);
  UPDATE public.tarefas t
     SET status = x.status::status_tarefa, data_cumprimento = NULL
    FROM jsonb_to_recordset(_itens) AS x(chave text, status text)
   WHERE t.coordenacao_id = _coordenacao_id AND t.origem = 'projuris'
     AND t.identificador_projuris = x.chave
     AND t.status = 'cumprido'
     AND x.status IN ('pendente','em_execucao','a_confirmar','revisao')
     AND NOT EXISTS (
       SELECT 1 FROM public.auditoria_tarefas a
        WHERE a.tarefa_id = t.id AND a.usuario_id IS NOT NULL
          AND COALESCE(a.campos_alterados::text, '') ILIKE '%status%'
     );
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END
$function$;
REVOKE ALL ON FUNCTION public.corrigir_status_tarefas_projuris(uuid, jsonb) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.corrigir_status_tarefas_projuris(uuid, jsonb) TO authenticated;