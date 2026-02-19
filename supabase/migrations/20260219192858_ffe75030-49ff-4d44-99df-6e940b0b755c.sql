-- Fix search_users_basic to restrict user enumeration
-- Only return users who share at least one coordenação with the caller
CREATE OR REPLACE FUNCTION public.search_users_basic(_query text DEFAULT NULL::text, _limit integer DEFAULT 5)
 RETURNS TABLE(id uuid, nome text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT DISTINCT p.id, p.nome
  FROM public.profiles p
  WHERE auth.uid() IS NOT NULL
    AND (
      -- Admin can see everyone
      public.is_admin_or_coordenador(auth.uid())
      OR
      -- Non-admins can only see users sharing at least one coordenação
      EXISTS (
        SELECT 1
        FROM public.membros_coordenacao mc1
        JOIN public.membros_coordenacao mc2
          ON mc1.coordenacao_id = mc2.coordenacao_id
        WHERE mc1.usuario_id = auth.uid()
          AND mc2.usuario_id = p.id
      )
      OR
      -- Include self always
      p.id = auth.uid()
    )
    AND (
      _query IS NULL
      OR btrim(_query) = ''
      OR p.nome ILIKE ('%' || _query || '%')
    )
  ORDER BY p.nome
  LIMIT GREATEST(LEAST(_limit, 50), 1);
$function$;
