CREATE OR REPLACE FUNCTION public.resolver_destinatarios_comentario(_entidade text, _entidade_id uuid)
 RETURNS uuid[]
 LANGUAGE plpgsql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  ids UUID[] := ARRAY[]::UUID[];
BEGIN
  IF _entidade = 'tarefa' THEN
    SELECT COALESCE(ARRAY_AGG(DISTINCT uid) FILTER (WHERE uid IS NOT NULL), ARRAY[]::UUID[]) INTO ids
    FROM (
      SELECT usuario_id AS uid FROM public.tarefa_responsaveis WHERE tarefa_id = _entidade_id
      UNION SELECT usuario_id FROM public.tarefa_envolvidos WHERE tarefa_id = _entidade_id
      UNION SELECT responsavel_id FROM public.tarefas WHERE id = _entidade_id
      UNION SELECT criado_por FROM public.tarefas WHERE id = _entidade_id
    ) t;
  ELSIF _entidade = 'evento' THEN
    SELECT COALESCE(ARRAY_AGG(DISTINCT uid) FILTER (WHERE uid IS NOT NULL), ARRAY[]::UUID[]) INTO ids
    FROM (
      SELECT usuario_id AS uid FROM public.evento_responsaveis WHERE evento_id = _entidade_id
      UNION SELECT usuario_id FROM public.evento_envolvidos WHERE evento_id = _entidade_id
      UNION SELECT criado_por FROM public.eventos_agenda WHERE id = _entidade_id
    ) t;
  ELSIF _entidade = 'audiencia' THEN
    SELECT COALESCE(ARRAY_AGG(DISTINCT uid) FILTER (WHERE uid IS NOT NULL), ARRAY[]::UUID[]) INTO ids
    FROM (
      SELECT usuario_id AS uid FROM public.audiencia_envolvidos WHERE audiencia_id = _entidade_id
      UNION SELECT advogado_id FROM public.audiencias_advogados WHERE audiencia_id = _entidade_id
      UNION SELECT criado_por FROM public.audiencias_detectadas WHERE id = _entidade_id
    ) t;
  END IF;
  RETURN COALESCE(ids, ARRAY[]::UUID[]);
END;
$function$;