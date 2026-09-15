CREATE TABLE IF NOT EXISTS public.zapi_conexao_estado (
  instancia text PRIMARY KEY,
  conectado boolean NOT NULL DEFAULT true,
  motivo text,
  verificado_em timestamptz NOT NULL DEFAULT now(),
  mudou_em timestamptz NOT NULL DEFAULT now(),
  ultimo_alerta_em timestamptz
);

GRANT SELECT ON public.zapi_conexao_estado TO authenticated;
GRANT ALL ON public.zapi_conexao_estado TO service_role;

ALTER TABLE public.zapi_conexao_estado ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins podem ver estado da Z-API" ON public.zapi_conexao_estado;
CREATE POLICY "Admins podem ver estado da Z-API"
ON public.zapi_conexao_estado
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$
DECLARE jid bigint;
BEGIN
  SELECT jobid INTO jid FROM cron.job WHERE jobname = 'monitorar-conexao-zapi-12h';
  IF jid IS NOT NULL THEN
    PERFORM cron.unschedule(jid);
  END IF;
END $$;

SELECT cron.schedule(
  'monitorar-conexao-zapi-12h',
  '0 */12 * * *',
  $$
  SELECT net.http_post(
    url := 'https://bfxahrrvoqxcdmfsvnrk.supabase.co/functions/v1/monitorar-conexao-zapi',
    headers := '{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJmeGFocnJ2b3F4Y2RtZnN2bnJrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyMjU0MDUsImV4cCI6MjA4MDgwMTQwNX0.bvVxZJYaaAIJXY4n9Gu3btoX5veywtNOSo79PFG6pQM"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);