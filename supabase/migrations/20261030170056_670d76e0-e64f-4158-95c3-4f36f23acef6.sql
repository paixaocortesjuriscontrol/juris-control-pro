CREATE OR REPLACE FUNCTION public.corrigir_titulos_por_modelo_projuris(_coordenacao_id uuid, _limite integer DEFAULT 2000)
RETURNS integer LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE n integer;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Apenas administradores'; END IF;
  WITH alvo AS (
    SELECT t.id, m.nome AS novo, t.titulo AS antigo
      FROM public.tarefas t JOIN public.modelos_titulo_coordenacao m ON m.id = t.modelo_tarefa_id
     WHERE t.coordenacao_id = _coordenacao_id AND t.origem = 'projuris'
       AND COALESCE(trim(m.nome), '') <> '' AND upper(trim(t.titulo)) IS DISTINCT FROM upper(trim(m.nome))
     LIMIT GREATEST(1, LEAST(_limite, 5000))
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