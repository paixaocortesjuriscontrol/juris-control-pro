CREATE OR REPLACE FUNCTION public.descartar_duplicadas_coordenacao(p_coordenacao_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN public.descartar_duplicadas_coordenacao(p_coordenacao_id, NULL::date, NULL::date);
END;
$function$;