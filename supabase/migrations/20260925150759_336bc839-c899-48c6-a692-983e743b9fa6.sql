CREATE OR REPLACE FUNCTION public.dados_benner_arquivados_existentes(_digitos text[])
RETURNS TABLE(digitos text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT DISTINCT regexp_replace(a.processo, '\D', '', 'g')
  FROM public.dados_benner_arquivados a
  WHERE a.processo IS NOT NULL
    AND regexp_replace(a.processo, '\D', '', 'g') = ANY(_digitos)
$$;
REVOKE EXECUTE ON FUNCTION public.dados_benner_arquivados_existentes(text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dados_benner_arquivados_existentes(text[]) TO authenticated, service_role;