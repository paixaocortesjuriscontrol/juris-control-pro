CREATE OR REPLACE FUNCTION public.corrigir_titulos_tarefas_projuris(_coordenacao_id uuid, _itens jsonb)
RETURNS integer LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE n integer;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Apenas administradores'; END IF;
  UPDATE public.tarefas t
     SET titulo = left(x.titulo, 500),
         descricao = COALESCE(NULLIF(x.descricao, ''), t.descricao),
         modelo_tarefa_id = COALESCE(t.modelo_tarefa_id, x.modelo_id)
    FROM jsonb_to_recordset(_itens) AS x(chave text, titulo text, descricao text, modelo_id uuid)
   WHERE t.coordenacao_id = _coordenacao_id AND t.origem = 'projuris'
     AND t.identificador_projuris = x.chave
     AND (t.titulo IS DISTINCT FROM left(x.titulo, 500) OR (x.modelo_id IS NOT NULL AND t.modelo_tarefa_id IS NULL));
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.corrigir_titulos_tarefas_projuris(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.corrigir_titulos_tarefas_projuris(uuid, jsonb) TO authenticated;