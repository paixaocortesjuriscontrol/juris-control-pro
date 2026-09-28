CREATE OR REPLACE FUNCTION public.get_convite_by_token(p_token text)
 RETURNS TABLE(id uuid, email text, status text, expira_em timestamp with time zone)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT cc.id,
    CASE WHEN cc.status = 'pendente' AND cc.expira_em > now() THEN cc.email END,
    cc.status, cc.expira_em
  FROM public.convites_cliente cc
  WHERE p_token IS NOT NULL AND length(p_token) >= 16 AND cc.token = p_token
  LIMIT 1;
$function$;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;