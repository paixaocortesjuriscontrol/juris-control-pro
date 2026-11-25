CREATE INDEX IF NOT EXISTS idx_tarefas_modelo_venc ON public.tarefas (data_vencimento) WHERE modelo_tarefa_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.resumo_comentarios_itens(_tipo text, _ids uuid[])
RETURNS TABLE(ref uuid, ultimo timestamptz, meu boolean, outros boolean, cobranca boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN RETURN; END IF;
  IF _tipo = 'tarefa' THEN
    RETURN QUERY WITH ok AS (SELECT i FROM (SELECT DISTINCT unnest(_ids) i) s WHERE public.can_comment_tarefa(_uid, s.i))
    SELECT c.tarefa_id, max(c.created_at), bool_or(c.autor_id = _uid), bool_or(c.autor_id IS DISTINCT FROM _uid), bool_or(coalesce(c.is_cobranca,false))
    FROM public.comentarios_tarefas c JOIN ok ON ok.i = c.tarefa_id
    GROUP BY c.tarefa_id, (c.created_at AT TIME ZONE 'America/Sao_Paulo')::date;
  ELSIF _tipo = 'audiencia' THEN
    RETURN QUERY WITH ok AS (SELECT i FROM (SELECT DISTINCT unnest(_ids) i) s WHERE public.can_comment_audiencia(_uid, s.i))
    SELECT c.audiencia_id, max(c.created_at), bool_or(c.autor_id = _uid), bool_or(c.autor_id IS DISTINCT FROM _uid), bool_or(coalesce(c.is_cobranca,false))
    FROM public.comentarios_audiencias c JOIN ok ON ok.i = c.audiencia_id
    GROUP BY c.audiencia_id, (c.created_at AT TIME ZONE 'America/Sao_Paulo')::date;
  ELSIF _tipo = 'evento' THEN
    RETURN QUERY SELECT c.evento_id, max(c.created_at), bool_or(c.autor_id = _uid), bool_or(c.autor_id IS DISTINCT FROM _uid), bool_or(coalesce(c.is_cobranca,false))
    FROM public.comentarios_eventos c WHERE c.evento_id = ANY(_ids)
    GROUP BY c.evento_id, (c.created_at AT TIME ZONE 'America/Sao_Paulo')::date;
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.resumo_comentarios_itens(text, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resumo_comentarios_itens(text, uuid[]) TO authenticated;