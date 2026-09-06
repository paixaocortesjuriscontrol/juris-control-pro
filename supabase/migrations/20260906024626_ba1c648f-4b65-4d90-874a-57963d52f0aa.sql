REVOKE EXECUTE ON FUNCTION public.get_distribuicao_tst_stats(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_distribuicao_tst_stats(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_distribuicao_tst_stats(jsonb) TO service_role;