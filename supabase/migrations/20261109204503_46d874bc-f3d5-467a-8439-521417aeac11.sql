DO $$ DECLARE d text; BEGIN
 SELECT replace(pg_get_functiondef('public.reaper_execucoes_servidor_travadas'::regproc),'/monitoramento-djen-servidor','/djen-servidor') INTO d; EXECUTE d;
 SELECT replace(pg_get_functiondef('public.notificar_conclusao_retomada_servidor'::regproc),'/monitoramento-djen-servidor','/djen-servidor') INTO d; EXECUTE d;
END $$;