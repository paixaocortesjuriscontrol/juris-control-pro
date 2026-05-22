ALTER FUNCTION public.get_distribuicao_tst_stats(jsonb) SECURITY DEFINER;
ALTER FUNCTION public.get_distribuicao_tst_stats(jsonb) SET search_path = public;
REVOKE EXECUTE ON FUNCTION public.get_distribuicao_tst_stats(jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_distribuicao_tst_stats(jsonb) TO authenticated;