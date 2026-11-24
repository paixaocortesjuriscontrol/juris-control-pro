CREATE OR REPLACE FUNCTION public.can_access_evento(_user_id uuid, _evento_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    public.is_admin_or_coordenador(_user_id)
    OR EXISTS (
      SELECT 1
      FROM public.eventos_agenda e
      WHERE e.id = _evento_id
        AND e.criado_por = _user_id
    )
    OR EXISTS (
      SELECT 1
      FROM public.participantes_evento pe
      WHERE pe.evento_id = _evento_id
        AND pe.usuario_id = _user_id
    )
    OR EXISTS (
      SELECT 1
      FROM public.evento_responsaveis er
      WHERE er.evento_id = _evento_id
        AND er.usuario_id = _user_id
    )
    OR EXISTS (
      SELECT 1
      FROM public.evento_envolvidos ee
      WHERE ee.evento_id = _evento_id
        AND ee.usuario_id = _user_id
    );
$function$;