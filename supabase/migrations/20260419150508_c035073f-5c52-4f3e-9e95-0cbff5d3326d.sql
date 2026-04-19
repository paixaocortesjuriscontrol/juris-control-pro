CREATE OR REPLACE FUNCTION public.get_dados_benner_sem_responsavel()
RETURNS TABLE(id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT db.id
  FROM public.dados_benner db
  WHERE db.aba_origem IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.dados_benner_responsaveis r
      WHERE r.dados_benner_id = db.id
    );
$$;

GRANT EXECUTE ON FUNCTION public.get_dados_benner_sem_responsavel() TO authenticated;