-- Reagendar para 23:20 BRT (02:20 UTC) para testar
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'monitorar-djen-2312';

SELECT cron.schedule(
  'monitorar-djen-2320',
  '20 2 * * *',
  $$
  SELECT net.http_post(
    url:='https://bfxahrrvoqxcdmfsvnrk.supabase.co/functions/v1/monitorar-djen',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJmeGFocnJ2b3F4Y2RtZnN2bnJrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyMjU0MDUsImV4cCI6MjA4MDgwMTQwNX0.bvVxZJYaaAIJXY4n9Gu3btoX5veywtNOSo79PFG6pQM"}'::jsonb,
    body:='{"scheduled": true, "completeRun": true}'::jsonb
  ) AS request_id;
  $$
);