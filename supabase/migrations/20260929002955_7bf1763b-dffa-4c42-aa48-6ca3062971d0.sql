
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname, cmd, roles, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public'
      AND (qual = 'true' OR with_check = 'true')
      AND NOT (roles = ARRAY['service_role']::name[])
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
    EXECUTE format(
      'CREATE POLICY %I ON %I.%I FOR %s TO %s %s %s',
      r.policyname, r.schemaname, r.tablename, r.cmd,
      (SELECT string_agg(quote_ident(x), ', ') FROM unnest(r.roles) x),
      CASE WHEN r.cmd IN ('SELECT','UPDATE','DELETE','ALL') THEN 'USING (auth.uid() IS NOT NULL)' ELSE '' END,
      CASE WHEN r.cmd IN ('INSERT','UPDATE','ALL') THEN 'WITH CHECK (auth.uid() IS NOT NULL)' ELSE '' END
    );
  END LOOP;
END $$;
