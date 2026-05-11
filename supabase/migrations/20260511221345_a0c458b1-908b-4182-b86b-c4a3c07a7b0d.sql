
ALTER TABLE public.dados_benner
  ADD COLUMN IF NOT EXISTS fontes_importacao text[] NOT NULL DEFAULT '{}'::text[];

CREATE INDEX IF NOT EXISTS idx_dados_benner_fontes_importacao
  ON public.dados_benner USING GIN (fontes_importacao);

CREATE OR REPLACE FUNCTION public.add_fonte_importacao(p_id uuid, p_fonte text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.dados_benner
  SET fontes_importacao = (
    SELECT COALESCE(array_agg(DISTINCT x ORDER BY x), '{}'::text[])
    FROM unnest(COALESCE(fontes_importacao, '{}'::text[]) || ARRAY[p_fonte]) AS x
    WHERE x IS NOT NULL AND x <> ''
  )
  WHERE id = p_id;
$$;

GRANT EXECUTE ON FUNCTION public.add_fonte_importacao(uuid, text) TO authenticated;

UPDATE public.dados_benner
SET fontes_importacao = ARRAY['Certidão TST']
WHERE aba_origem = 'Certidão TST'
  AND NOT ('Certidão TST' = ANY(fontes_importacao));
