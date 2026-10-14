DO $$ DECLARE r record; BEGIN
FOR r IN SELECT tgname, tgrelid::regclass AS tbl FROM pg_trigger WHERE NOT tgisinternal AND tgfoid = 'public.add_coordenadores_envolvidos'::regproc LOOP
EXECUTE format('DROP TRIGGER IF EXISTS %I ON %s', r.tgname, r.tbl);
END LOOP; END $$;