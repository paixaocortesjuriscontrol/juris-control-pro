DO $$
DECLARE cmd text; jid bigint;
BEGIN
  SELECT command INTO cmd FROM cron.job WHERE jobname='acomp-especial-repescagem';
  SELECT jobid INTO jid FROM cron.job WHERE jobname='acomp-especial-recuperacao-20261127';
  cmd := regexp_replace(rtrim(trim(cmd), ';'), '^\s*select', 'PERFORM', 'i');
  PERFORM cron.alter_job(jid, command := 'DO $b$ BEGIN IF (now() AT TIME ZONE ''America/Sao_Paulo'')::date > DATE ''2026-11-27'' THEN PERFORM cron.unschedule(''acomp-especial-recuperacao-20261127''); ELSE ' || cmd || '; END IF; END $b$;');
END $$;