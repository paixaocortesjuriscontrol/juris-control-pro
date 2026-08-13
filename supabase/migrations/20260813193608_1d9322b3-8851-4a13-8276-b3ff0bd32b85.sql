CREATE OR REPLACE FUNCTION public.find_processo_by_digits(_numero text)
RETURNS TABLE(id uuid, numero text, coordenacao_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT p.id, p.numero, p.coordenacao_id
  FROM public.processos p
  WHERE regexp_replace(coalesce(p.numero,''), '\D', '', 'g') = regexp_replace(coalesce(_numero,''), '\D', '', 'g')
    AND regexp_replace(coalesce(_numero,''), '\D', '', 'g') <> ''
  ORDER BY p.created_at NULLS LAST
  LIMIT 1;
$function$;

GRANT EXECUTE ON FUNCTION public.find_processo_by_digits(text) TO authenticated, service_role;