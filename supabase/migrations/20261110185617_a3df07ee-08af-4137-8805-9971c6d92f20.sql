DO $$ DECLARE d text; BEGIN
  d := pg_get_functiondef('public.reaper_execucoes_servidor_travadas'::regproc);
  d := replace(d, 'e.iniciado_em < now() - interval ''30 minutes''', 'e.iniciado_em < now() - interval ''3 minutes''');
  EXECUTE d;
END $$;