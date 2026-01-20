
-- Limpar o que aparece na Análise DJEN com filtro "Apenas hoje".
-- IMPORTANTE: a tela filtra por created_at (timestamptz) comparando com a data local (BRT) -> na prática vira created_at::date = hoje_brt.
WITH params AS (
  SELECT (now() at time zone 'America/Sao_Paulo')::date AS d
)
DELETE FROM public.publicacoes_djen
WHERE created_at::date = (SELECT d FROM params);

WITH params AS (
  SELECT (now() at time zone 'America/Sao_Paulo')::date AS d
)
DELETE FROM public.publicacoes_djen_processos
WHERE created_at::date = (SELECT d FROM params);

WITH params AS (
  SELECT (now() at time zone 'America/Sao_Paulo')::date AS d
)
DELETE FROM public.publicacoes_djen_descartadas
WHERE created_at::date = (SELECT d FROM params);

WITH params AS (
  SELECT (now() at time zone 'America/Sao_Paulo')::date AS d
)
DELETE FROM public.publicacoes_djen_global_hash
WHERE created_at::date = (SELECT d FROM params);

-- Resetar offset do DJEN para reprocessar do zero no próximo run
UPDATE public.configuracoes_monitoramento
SET metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{next_offset}', '0')
WHERE tipo = 'djen';

-- Reagendar teste para 23:00 BRT (02:00 UTC)
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'monitorar-djen-teste-2255';
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'monitorar-djen-teste-23h';

SELECT cron.schedule(
  'monitorar-djen-teste-23h',
  '0 2 * * *',
  $$
  SELECT net.http_post(
    url:='https://bfxahrrvoqxcdmfsvnrk.supabase.co/functions/v1/monitorar-djen',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJmeGFocnJ2b3F4Y2RtZnN2bnJrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyMjU0MDUsImV4cCI6MjA4MDgwMTQwNX0.bvVxZJYaaAIJXY4n9Gu3btoX5veywtNOSo79PFG6pQM"}'::jsonb,
    body:='{"scheduled": true, "completeRun": true}'::jsonb
  ) AS request_id;
  $$
);

-- Restaurar o job da manhã (caso tenha sido removido antes)
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'monitorar-djen-manha';
SELECT cron.schedule(
  'monitorar-djen-manha',
  '55 12 * * *',
  $$
  SELECT net.http_post(
    url:='https://bfxahrrvoqxcdmfsvnrk.supabase.co/functions/v1/monitorar-djen',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJmeGFocnJ2b3F4Y2RtZnN2bnJrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyMjU0MDUsImV4cCI6MjA4MDgwMTQwNX0.bvVxZJYaaAIJXY4n9Gu3btoX5veywtNOSo79PFG6pQM"}'::jsonb,
    body:='{"scheduled": true}'::jsonb
  ) AS request_id;
  $$
);
