CREATE INDEX IF NOT EXISTS idx_dados_benner_processo_digitos_all
  ON public.dados_benner (regexp_replace(processo, '\D', '', 'g'))
  WHERE processo IS NOT NULL;

CREATE OR REPLACE FUNCTION public.dados_benner_processos_existentes(_digitos text[])
RETURNS TABLE(digitos text, dossie text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT regexp_replace(d.processo, '\D', '', 'g') AS digitos,
         coalesce(lower(btrim(d.dossie)), '') AS dossie
  FROM public.dados_benner d
  WHERE d.processo IS NOT NULL
    AND regexp_replace(d.processo, '\D', '', 'g') = ANY(_digitos)
  GROUP BY 1, 2
$$;

GRANT EXECUTE ON FUNCTION public.dados_benner_processos_existentes(text[]) TO authenticated, service_role;