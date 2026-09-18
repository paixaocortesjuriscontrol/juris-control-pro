CREATE INDEX IF NOT EXISTS idx_dados_benner_processo_digitos
  ON public.dados_benner (regexp_replace(processo, '\D', '', 'g'))
  WHERE aba_origem IS NOT NULL AND processo IS NOT NULL;

CREATE OR REPLACE FUNCTION public.get_duplicados_tst()
RETURNS TABLE(chave text, ids uuid[])
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT k.chave, array_agg(k.id ORDER BY k.id) AS ids
  FROM (
    SELECT b.id,
           CASE
             WHEN length(regexp_replace(b.processo, '\D', '', 'g')) >= 20
               THEN regexp_replace(b.processo, '\D', '', 'g')
             ELSE lower(btrim(b.processo))
           END AS chave
    FROM public.dados_benner b
    WHERE b.aba_origem IS NOT NULL
      AND b.processo IS NOT NULL
      AND btrim(b.processo) <> ''
  ) k
  GROUP BY k.chave
  HAVING count(*) > 1
$$;

GRANT EXECUTE ON FUNCTION public.get_duplicados_tst() TO authenticated, service_role;