-- Reagendar monitorar-djen-manha para 9:55 BRT (12:55 UTC)
SELECT cron.unschedule('monitorar-djen-manha');

SELECT cron.schedule(
  'monitorar-djen-manha',
  '55 12 * * *',
  $$
  SELECT net.http_post(
    url:='https://bfxahrrvoqxcdmfsvnrk.supabase.co/functions/v1/monitorar-djen',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJmeGFocnJ2b3F4Y2RtZnN2bnJrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyMjU0MDUsImV4cCI6MjA4MDgwMTQwNX0.bvVxZJYaaAIJXY4n9Gu3btoX5veywtNOSo79PFG6pQM"}'::jsonb,
    body:='{"source": "cron"}'::jsonb
  ) AS request_id;
  $$
);