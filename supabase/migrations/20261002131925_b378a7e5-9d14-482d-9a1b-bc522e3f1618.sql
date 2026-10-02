CREATE OR REPLACE FUNCTION public.can_access_processo(_user_id uuid, _processo_id uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM processos p
    WHERE p.id = _processo_id
    AND (
      p.advogado_responsavel_id = _user_id
      OR is_admin_or_coordenador(_user_id)
      OR p.coordenacao_id IN (SELECT coordenacao_id FROM membros_coordenacao WHERE usuario_id = _user_id)
      OR EXISTS (
        SELECT 1 FROM processos_coordenacoes_responsaveis r
        JOIN membros_coordenacao m ON m.coordenacao_id = r.coordenacao_id
        WHERE r.processo_id = p.id AND m.usuario_id = _user_id
      )
    )
  )
$function$;