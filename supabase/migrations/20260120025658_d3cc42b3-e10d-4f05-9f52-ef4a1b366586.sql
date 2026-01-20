-- Forçar UI e configuração para "1x ao dia" (09h BRT)
UPDATE public.configuracoes_monitoramento
SET frequencia = 'diario', updated_at = now()
WHERE tipo IN ('djen', 'djen_processos');

-- Remover TODOS os cron jobs que chamam monitorar-djen-processos (inclui manha/tarde/qualquer extra)
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT jobid
    FROM cron.job
    WHERE command ILIKE '%/functions/v1/monitorar-djen-processos%'
  ) LOOP
    PERFORM cron.unschedule(r.jobid);
  END LOOP;
END $$;

-- Criar único cron diário às 09:00 BRT (12:00 UTC) para DJEN Processos
SELECT cron.schedule(
  'monitorar-djen-processos-diario',
  '0 12 * * *',
  $$
  SELECT net.http_post(
    url:='https://bfxahrrvoqxcdmfsvnrk.supabase.co/functions/v1/monitorar-djen-processos',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJmeGFocnJ2b3F4Y2RtZnN2bnJrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyMjU0MDUsImV4cCI6MjA4MDgwMTQwNX0.bvVxZJYaaAIJXY4n9Gu3btoX5veywtNOSo79PFG6pQM"}'::jsonb,
    body:='{"scheduled": true, "completeRun": true}'::jsonb
  ) AS request_id;
  $$
);
