REVOKE ALL ON FUNCTION public.buscar_processos_global(text, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.buscar_processos_global(text, integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.buscar_processos_global(text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.buscar_processos_global(text, integer) TO service_role;