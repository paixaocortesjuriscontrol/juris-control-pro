-- Atualizar cron job do DJEN da manhã para 9:20 BRT (12:20 UTC)
SELECT cron.unschedule('monitorar-djen-manha');

SELECT cron.schedule(
  'monitorar-djen-manha',
  '20 12 * * *',
  $$
  SELECT net.http_post(
    url:='https://hsjqmzxxkgpshlygvhzk.supabase.co/functions/v1/monitorar-djen',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhzanFtenhna2dwc2hseWd2aHprIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI4NDY0NzQsImV4cCI6MjA1ODQyMjQ3NH0.xH-wMbMkWmBmDjQjK6GK1X2xYw4dEMHqn36jgFU-WAU"}'::jsonb,
    body:='{"source": "cron"}'::jsonb
  ) AS request_id;
  $$
);