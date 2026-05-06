-- Garante extensões
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Remove job antigo se existir
DO $$
DECLARE jid bigint;
BEGIN
  SELECT jobid INTO jid FROM cron.job WHERE jobname = 'djet-pautas-trigger-5min';
  IF jid IS NOT NULL THEN
    PERFORM cron.unschedule(jid);
  END IF;
END $$;

-- Agenda novo job a cada 5 minutos
SELECT cron.schedule(
  'djet-pautas-trigger-5min',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://bfxahrrvoqxcdmfsvnrk.supabase.co/functions/v1/executar-djet-pautas-agendado',
    headers := '{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJmeGFocnJ2b3F4Y2RtZnN2bnJrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyMjU0MDUsImV4cCI6MjA4MDgwMTQwNX0.bvVxZJYaaAIJXY4n9Gu3btoX5veywtNOSo79PFG6pQM"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);