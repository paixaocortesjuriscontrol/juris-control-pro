-- ================================================================
-- SCRIPT DE CONFIGURAÇÃO DOS CRON JOBS - APENAS MANHÃ
-- 
-- Horários em BRT (adicionar 3h para UTC):
-- - DJEN: 9h BRT = 12h UTC
-- - DJEN Processos: 9h BRT = 12h UTC
-- - Distribuições: 9h BRT = 12h UTC
-- - Andamentos: 9:45 BRT = 12:45 UTC
-- - Redistribuições: 10h BRT = 13h UTC
-- - Monitoração 360 (Termos): 9h BRT = 12h UTC
--
-- Execute no SQL Editor do Supabase
-- Dashboard > SQL Editor > New Query
-- ================================================================

-- ================================================================
-- 1. REMOVER JOBS EXISTENTES (evitar duplicatas)
-- ================================================================

SELECT cron.unschedule('exec-redistribuicoes-manha');
SELECT cron.unschedule('exec-redistribuicoes-tarde');
SELECT cron.unschedule('exec-andamentos-manha');
SELECT cron.unschedule('exec-andamentos-tarde');
SELECT cron.unschedule('exec-distribuicoes-manha');
SELECT cron.unschedule('exec-distribuicoes-tarde');
SELECT cron.unschedule('exec-termos-manha');
SELECT cron.unschedule('exec-termos-tarde');
SELECT cron.unschedule('monitorar-djen-manha');
SELECT cron.unschedule('monitorar-djen-tarde');
SELECT cron.unschedule('monitorar-djen-processos-manha');
SELECT cron.unschedule('monitorar-djen-processos-tarde');

-- ================================================================
-- 2. DJEN (Termos) - 9h BRT = 12h UTC
-- ================================================================

SELECT cron.schedule(
  'monitorar-djen-manha',
  '0 12 * * *',
  $$
  SELECT net.http_post(
    url := 'https://bfxahrrvoqxcdmfsvnrk.supabase.co/functions/v1/monitorar-djen',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJmeGFocnJ2b3F4Y2RtZnN2bnJrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyMjU0MDUsImV4cCI6MjA4MDgwMTQwNX0.bvVxZJYaaAIJXY4n9Gu3btoX5veywtNOSo79PFG6pQM"}'::jsonb,
    body := '{"scheduled": true, "completeRun": true}'::jsonb
  ) AS request_id;
  $$
);

-- ================================================================
-- 3. DJEN Processos - 9h BRT = 12h UTC
-- ================================================================

SELECT cron.schedule(
  'monitorar-djen-processos-manha',
  '0 12 * * *',
  $$
  SELECT net.http_post(
    url := 'https://bfxahrrvoqxcdmfsvnrk.supabase.co/functions/v1/monitorar-djen-processos',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJmeGFocnJ2b3F4Y2RtZnN2bnJrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyMjU0MDUsImV4cCI6MjA4MDgwMTQwNX0.bvVxZJYaaAIJXY4n9Gu3btoX5veywtNOSo79PFG6pQM"}'::jsonb,
    body := '{"scheduled": true, "completeRun": true}'::jsonb
  ) AS request_id;
  $$
);

-- ================================================================
-- 4. Distribuições - 9h BRT = 12h UTC
-- ================================================================

SELECT cron.schedule(
  'exec-distribuicoes-manha',
  '0 12 * * *',
  $$
  SELECT net.http_post(
    url := 'https://bfxahrrvoqxcdmfsvnrk.supabase.co/functions/v1/executar-monitoramento',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJmeGFocnJ2b3F4Y2RtZnN2bnJrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyMjU0MDUsImV4cCI6MjA4MDgwMTQwNX0.bvVxZJYaaAIJXY4n9Gu3btoX5veywtNOSo79PFG6pQM"}'::jsonb,
    body := '{"tipo": "distribuicoes", "scheduled": true}'::jsonb
  ) AS request_id;
  $$
);

-- ================================================================
-- 5. Andamentos - 9:45 BRT = 12:45 UTC
-- ================================================================

SELECT cron.schedule(
  'exec-andamentos-manha',
  '45 12 * * *',
  $$
  SELECT net.http_post(
    url := 'https://bfxahrrvoqxcdmfsvnrk.supabase.co/functions/v1/executar-monitoramento',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJmeGFocnJ2b3F4Y2RtZnN2bnJrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyMjU0MDUsImV4cCI6MjA4MDgwMTQwNX0.bvVxZJYaaAIJXY4n9Gu3btoX5veywtNOSo79PFG6pQM"}'::jsonb,
    body := '{"tipo": "andamentos", "scheduled": true}'::jsonb
  ) AS request_id;
  $$
);

-- ================================================================
-- 6. Redistribuições - 10h BRT = 13h UTC
-- ================================================================

SELECT cron.schedule(
  'exec-redistribuicoes-manha',
  '0 13 * * *',
  $$
  SELECT net.http_post(
    url := 'https://bfxahrrvoqxcdmfsvnrk.supabase.co/functions/v1/executar-monitoramento',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJmeGFocnJ2b3F4Y2RtZnN2bnJrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyMjU0MDUsImV4cCI6MjA4MDgwMTQwNX0.bvVxZJYaaAIJXY4n9Gu3btoX5veywtNOSo79PFG6pQM"}'::jsonb,
    body := '{"tipo": "redistribuicoes", "scheduled": true}'::jsonb
  ) AS request_id;
  $$
);

-- ================================================================
-- 7. Monitoração 360 (Termos) - 9h BRT = 12h UTC
-- ================================================================

SELECT cron.schedule(
  'exec-termos-manha',
  '0 14 * * *',  -- 11h BRT (14h UTC)
  $$
  SELECT net.http_post(
    url := 'https://bfxahrrvoqxcdmfsvnrk.supabase.co/functions/v1/executar-monitoramento',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJmeGFocnJ2b3F4Y2RtZnN2bnJrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyMjU0MDUsImV4cCI6MjA4MDgwMTQwNX0.bvVxZJYaaAIJXY4n9Gu3btoX5veywtNOSo79PFG6pQM"}'::jsonb,
    body := '{"tipo": "termos", "scheduled": true}'::jsonb
  ) AS request_id;
  $$
);

-- ================================================================
-- 8. VERIFICAR TODOS OS JOBS CONFIGURADOS
-- ================================================================

SELECT 
  jobid, 
  jobname, 
  schedule,
  CASE 
    WHEN schedule = '0 12 * * *' THEN '09:00 BRT'
    WHEN schedule = '45 12 * * *' THEN '09:45 BRT'
    WHEN schedule = '0 13 * * *' THEN '10:00 BRT'
    ELSE schedule
  END AS horario_brt,
  active 
FROM cron.job 
WHERE jobname LIKE 'exec-%' 
   OR jobname LIKE 'monitorar-djen%'
ORDER BY schedule, jobname;
