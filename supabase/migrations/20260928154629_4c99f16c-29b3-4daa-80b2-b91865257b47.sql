ALTER FUNCTION public.strip_destinatarios SET search_path = public;
ALTER FUNCTION public.update_pautas_tst_updated_at() SET search_path = public;
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig, p.proname
    FROM pg_proc p JOIN pg_namespace s ON s.oid=p.pronamespace
    WHERE s.nspname='public' AND p.prosecdef
      AND has_function_privilege('anon', p.oid, 'execute')
      AND p.proname <> 'get_convite_by_token'
      AND NOT EXISTS (SELECT 1 FROM pg_policies pol WHERE pol.qual ILIKE '%'||p.proname||'(%' OR pol.with_check ILIKE '%'||p.proname||'(%')
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon, public', r.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', r.sig);
  END LOOP;
END $$;