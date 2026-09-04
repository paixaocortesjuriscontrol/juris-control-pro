CREATE OR REPLACE FUNCTION public.tem_pedidos_dossie(db public.dados_benner)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT db.dossie IS NOT NULL
     AND btrim(db.dossie) <> ''
     AND EXISTS (
       SELECT 1 FROM public.pedidos_por_dossie pd WHERE pd.dossie = db.dossie
     )
$$;

GRANT EXECUTE ON FUNCTION public.tem_pedidos_dossie(public.dados_benner) TO authenticated;