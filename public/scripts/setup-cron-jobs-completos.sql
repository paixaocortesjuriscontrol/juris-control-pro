-- =============================================
-- CRON JOBS PARA EXECUÇÃO COMPLETA DOS MONITORAMENTOS
-- =============================================
-- Execute este script no SQL Editor do Supabase Dashboard
-- https://supabase.com/dashboard/project/bfxahrrvoqxcdmfsvnrk/sql/new
-- =============================================

-- =============================================
-- 1. MONITORAR ANDAMENTOS
-- Executa 2x ao dia (09h e 18h BRT)
-- =============================================

-- Remove jobs antigos
SELECT cron.unschedule('monitorar-andamentos-manha');
SELECT cron.unschedule('monitorar-andamentos-tarde');

-- 09h BRT = 12h UTC
SELECT cron.schedule(
  'monitorar-andamentos-manha',
  '0 12 * * *',
  $$
  SELECT net.http_post(
    url := 'https://bfxahrrvoqxcdmfsvnrk.supabase.co/functions/v1/monitorar-andamentos',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJmeGFocnJ2b3F4Y2RtZnN2bnJrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyMjU0MDUsImV4cCI6MjA4MDgwMTQwNX0.bvVxZJYaaAIJXY4n9Gu3btoX5veywtNOSo79PFG6pQM"}'::jsonb,
    body := '{"completeRun": true}'::jsonb
  );
  $$
);

-- 18h BRT = 21h UTC
SELECT cron.schedule(
  'monitorar-andamentos-tarde',
  '0 21 * * *',
  $$
  SELECT net.http_post(
    url := 'https://bfxahrrvoqxcdmfsvnrk.supabase.co/functions/v1/monitorar-andamentos',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJmeGFocnJ2b3F4Y2RtZnN2bnJrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyMjU0MDUsImV4cCI6MjA4MDgwMTQwNX0.bvVxZJYaaAIJXY4n9Gu3btoX5veywtNOSo79PFG6pQM"}'::jsonb,
    body := '{"completeRun": true}'::jsonb
  );
  $$
);

-- =============================================
-- 2. MONITORAR DJEN (Termos)
-- Executa 2x ao dia (09h e 18h BRT)
-- =============================================

-- Remove jobs antigos
SELECT cron.unschedule('monitorar-djen-manha');
SELECT cron.unschedule('monitorar-djen-tarde');

-- 09h BRT = 12h UTC
SELECT cron.schedule(
  'monitorar-djen-manha',
  '0 12 * * *',
  $$
  SELECT net.http_post(
    url := 'https://bfxahrrvoqxcdmfsvnrk.supabase.co/functions/v1/monitorar-djen',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJmeGFocnJ2b3F4Y2RtZnN2bnJrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyMjU0MDUsImV4cCI6MjA4MDgwMTQwNX0.bvVxZJYaaAIJXY4n9Gu3btoX5veywtNOSo79PFG6pQM"}'::jsonb,
    body := '{"completeRun": true}'::jsonb
  );
  $$
);

-- 18h BRT = 21h UTC
SELECT cron.schedule(
  'monitorar-djen-tarde',
  '0 21 * * *',
  $$
  SELECT net.http_post(
    url := 'https://bfxahrrvoqxcdmfsvnrk.supabase.co/functions/v1/monitorar-djen',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJmeGFocnJ2b3F4Y2RtZnN2bnJrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyMjU0MDUsImV4cCI6MjA4MDgwMTQwNX0.bvVxZJYaaAIJXY4n9Gu3btoX5veywtNOSo79PFG6pQM"}'::jsonb,
    body := '{"completeRun": true}'::jsonb
  );
  $$
);

-- =============================================
-- 3. MONITORAR DJEN PROCESSOS
-- Executa 2x ao dia (09h e 18h BRT)
-- =============================================

-- Remove jobs antigos
SELECT cron.unschedule('monitorar-djen-processos-manha');
SELECT cron.unschedule('monitorar-djen-processos-tarde');

-- 09h BRT = 12h UTC
SELECT cron.schedule(
  'monitorar-djen-processos-manha',
  '0 12 * * *',
  $$
  SELECT net.http_post(
    url := 'https://bfxahrrvoqxcdmfsvnrk.supabase.co/functions/v1/monitorar-djen-processos',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJmeGFocnJ2b3F4Y2RtZnN2bnJrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyMjU0MDUsImV4cCI6MjA4MDgwMTQwNX0.bvVxZJYaaAIJXY4n9Gu3btoX5veywtNOSo79PFG6pQM"}'::jsonb,
    body := '{"completeRun": true}'::jsonb
  );
  $$
);

-- 18h BRT = 21h UTC
SELECT cron.schedule(
  'monitorar-djen-processos-tarde',
  '0 21 * * *',
  $$
  SELECT net.http_post(
    url := 'https://bfxahrrvoqxcdmfsvnrk.supabase.co/functions/v1/monitorar-djen-processos',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJmeGFocnJ2b3F4Y2RtZnN2bnJrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyMjU0MDUsImV4cCI6MjA4MDgwMTQwNX0.bvVxZJYaaAIJXY4n9Gu3btoX5veywtNOSo79PFG6pQM"}'::jsonb,
    body := '{"completeRun": true}'::jsonb
  );
  $$
);

-- =============================================
-- 4. MONITORAR REDISTRIBUIÇÕES
-- Executa 2x ao dia (09h e 18h BRT)
-- =============================================

-- Remove jobs antigos
SELECT cron.unschedule('monitorar-redistribuicoes-manha');
SELECT cron.unschedule('monitorar-redistribuicoes-tarde');

-- 09h BRT = 12h UTC
SELECT cron.schedule(
  'monitorar-redistribuicoes-manha',
  '0 12 * * *',
  $$
  SELECT net.http_post(
    url := 'https://bfxahrrvoqxcdmfsvnrk.supabase.co/functions/v1/monitorar-redistribuicoes',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJmeGFocnJ2b3F4Y2RtZnN2bnJrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyMjU0MDUsImV4cCI6MjA4MDgwMTQwNX0.bvVxZJYaaAIJXY4n9Gu3btoX5veywtNOSo79PFG6pQM"}'::jsonb,
    body := '{"completeRun": true}'::jsonb
  );
  $$
);

-- 18h BRT = 21h UTC
SELECT cron.schedule(
  'monitorar-redistribuicoes-tarde',
  '0 21 * * *',
  $$
  SELECT net.http_post(
    url := 'https://bfxahrrvoqxcdmfsvnrk.supabase.co/functions/v1/monitorar-redistribuicoes',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJmeGFocnJ2b3F4Y2RtZnN2bnJrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyMjU0MDUsImV4cCI6MjA4MDgwMTQwNX0.bvVxZJYaaAIJXY4n9Gu3btoX5veywtNOSo79PFG6pQM"}'::jsonb,
    body := '{"completeRun": true}'::jsonb
  );
  $$
);

-- =============================================
-- 5. MONITORAR DISTRIBUIÇÕES
-- Executa 2x ao dia (09h e 18h BRT)
-- =============================================

-- Remove jobs antigos
SELECT cron.unschedule('monitorar-distribuicoes-manha');
SELECT cron.unschedule('monitorar-distribuicoes-tarde');

-- 09h BRT = 12h UTC
SELECT cron.schedule(
  'monitorar-distribuicoes-manha',
  '0 12 * * *',
  $$
  SELECT net.http_post(
    url := 'https://bfxahrrvoqxcdmfsvnrk.supabase.co/functions/v1/monitorar-distribuicoes',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJmeGFocnJ2b3F4Y2RtZnN2bnJrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyMjU0MDUsImV4cCI6MjA4MDgwMTQwNX0.bvVxZJYaaAIJXY4n9Gu3btoX5veywtNOSo79PFG6pQM"}'::jsonb,
    body := '{"completeRun": true}'::jsonb
  );
  $$
);

-- 18h BRT = 21h UTC
SELECT cron.schedule(
  'monitorar-distribuicoes-tarde',
  '0 21 * * *',
  $$
  SELECT net.http_post(
    url := 'https://bfxahrrvoqxcdmfsvnrk.supabase.co/functions/v1/monitorar-distribuicoes',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJmeGFocnJ2b3F4Y2RtZnN2bnJrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyMjU0MDUsImV4cCI6MjA4MDgwMTQwNX0.bvVxZJYaaAIJXY4n9Gu3btoX5veywtNOSo79PFG6pQM"}'::jsonb,
    body := '{"completeRun": true}'::jsonb
  );
  $$
);

-- =============================================
-- 6. PROCESSAR ALERTAS DJEN COORDENAÇÃO
-- Executa a cada minuto para verificar horários configurados
-- =============================================

-- Remove job antigo
SELECT cron.unschedule('processar-alertas-djen-coordenacao');

SELECT cron.schedule(
  'processar-alertas-djen-coordenacao',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://bfxahrrvoqxcdmfsvnrk.supabase.co/functions/v1/processar-alertas-djen-coordenacao',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJmeGFocnJ2b3F4Y2RtZnN2bnJrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyMjU0MDUsImV4cCI6MjA4MDgwMTQwNX0.bvVxZJYaaAIJXY4n9Gu3btoX5veywtNOSo79PFG6pQM"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);

-- =============================================
-- 7. ENVIAR ALERTAS MONITORAÇÃO 360 POR EMAIL
-- Executa 1x ao dia às 19h BRT (22h UTC)
-- =============================================

-- Remove job antigo
SELECT cron.unschedule('enviar-alertas-360-email');

SELECT cron.schedule(
  'enviar-alertas-360-email',
  '0 22 * * *',
  $$
  SELECT net.http_post(
    url := 'https://bfxahrrvoqxcdmfsvnrk.supabase.co/functions/v1/enviar-alertas-360-email',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJmeGFocnJ2b3F4Y2RtZnN2bnJrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyMjU0MDUsImV4cCI6MjA4MDgwMTQwNX0.bvVxZJYaaAIJXY4n9Gu3btoX5veywtNOSo79PFG6pQM"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);

-- =============================================
-- VERIFICAR JOBS CONFIGURADOS
-- =============================================
SELECT jobid, jobname, schedule, active 
FROM cron.job 
WHERE jobname LIKE 'monitorar%' OR jobname LIKE 'processar-alertas%' OR jobname LIKE 'enviar-alertas%'
ORDER BY jobname;
