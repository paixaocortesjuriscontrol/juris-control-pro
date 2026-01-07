-- ================================================================
-- SCRIPT DEFINITIVO DE CONFIGURAÇÃO DOS CRON JOBS DE MONITORAMENTO
-- Execute este script no SQL Editor do Supabase Dashboard
-- ================================================================

-- Substitua YOUR_ANON_KEY pelo seu anon key do Supabase
-- Você pode encontrar em: Project Settings > API > anon key

-- ================================================================
-- 1. MONITORAMENTO DE REDISTRIBUIÇÕES (2x ao dia: 7h e 18h BRT)
-- ================================================================

-- Remover jobs antigos se existirem
SELECT cron.unschedule('monitorar-redistribuicoes-diario') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'monitorar-redistribuicoes-diario'
);
SELECT cron.unschedule('monitorar-redistribuicoes-manha') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'monitorar-redistribuicoes-manha'
);
SELECT cron.unschedule('monitorar-redistribuicoes-tarde') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'monitorar-redistribuicoes-tarde'
);

-- Criar jobs de redistribuição (2x ao dia)
SELECT cron.schedule(
  'monitorar-redistribuicoes-manha',
  '0 10 * * *', -- 7h BRT (10h UTC)
  $$
  SELECT net.http_post(
    url := 'https://bfxahrrvoqxcdmfsvnrk.supabase.co/functions/v1/monitorar-redistribuicoes',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJmeGFocnJ2b3F4Y2RtZnN2bnJrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyMjU0MDUsImV4cCI6MjA4MDgwMTQwNX0.bvVxZJYaaAIJXY4n9Gu3btoX5veywtNOSo79PFG6pQM"}'::jsonb,
    body := '{"completeRun": true}'::jsonb
  );
  $$
);

SELECT cron.schedule(
  'monitorar-redistribuicoes-tarde',
  '0 21 * * *', -- 18h BRT (21h UTC)
  $$
  SELECT net.http_post(
    url := 'https://bfxahrrvoqxcdmfsvnrk.supabase.co/functions/v1/monitorar-redistribuicoes',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJmeGFocnJ2b3F4Y2RtZnN2bnJrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyMjU0MDUsImV4cCI6MjA4MDgwMTQwNX0.bvVxZJYaaAIJXY4n9Gu3btoX5veywtNOSo79PFG6pQM"}'::jsonb,
    body := '{"completeRun": true}'::jsonb
  );
  $$
);

-- ================================================================
-- 2. MONITORAMENTO DE ANDAMENTOS (5x ao dia: 08:00, 12:00, 14:00, 18:00, 22:00 BRT)
-- ================================================================

-- Remover jobs antigos se existirem
SELECT cron.unschedule('monitorar-andamentos-08h') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'monitorar-andamentos-08h'
);
SELECT cron.unschedule('monitorar-andamentos-12h') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'monitorar-andamentos-12h'
);
SELECT cron.unschedule('monitorar-andamentos-14h') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'monitorar-andamentos-14h'
);
SELECT cron.unschedule('monitorar-andamentos-18h') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'monitorar-andamentos-18h'
);
SELECT cron.unschedule('monitorar-andamentos-22h') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'monitorar-andamentos-22h'
);

-- Criar jobs de andamentos para cada horário configurado
SELECT cron.schedule(
  'monitorar-andamentos-08h',
  '0 11 * * *', -- 08h BRT (11h UTC)
  $$
  SELECT net.http_post(
    url := 'https://bfxahrrvoqxcdmfsvnrk.supabase.co/functions/v1/monitorar-andamentos',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJmeGFocnJ2b3F4Y2RtZnN2bnJrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyMjU0MDUsImV4cCI6MjA4MDgwMTQwNX0.bvVxZJYaaAIJXY4n9Gu3btoX5veywtNOSo79PFG6pQM"}'::jsonb,
    body := '{"completeRun": true}'::jsonb
  );
  $$
);

SELECT cron.schedule(
  'monitorar-andamentos-12h',
  '0 15 * * *', -- 12h BRT (15h UTC)
  $$
  SELECT net.http_post(
    url := 'https://bfxahrrvoqxcdmfsvnrk.supabase.co/functions/v1/monitorar-andamentos',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJmeGFocnJ2b3F4Y2RtZnN2bnJrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyMjU0MDUsImV4cCI6MjA4MDgwMTQwNX0.bvVxZJYaaAIJXY4n9Gu3btoX5veywtNOSo79PFG6pQM"}'::jsonb,
    body := '{"completeRun": true}'::jsonb
  );
  $$
);

SELECT cron.schedule(
  'monitorar-andamentos-14h',
  '0 17 * * *', -- 14h BRT (17h UTC)
  $$
  SELECT net.http_post(
    url := 'https://bfxahrrvoqxcdmfsvnrk.supabase.co/functions/v1/monitorar-andamentos',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJmeGFocnJ2b3F4Y2RtZnN2bnJrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyMjU0MDUsImV4cCI6MjA4MDgwMTQwNX0.bvVxZJYaaAIJXY4n9Gu3btoX5veywtNOSo79PFG6pQM"}'::jsonb,
    body := '{"completeRun": true}'::jsonb
  );
  $$
);

SELECT cron.schedule(
  'monitorar-andamentos-18h',
  '0 21 * * *', -- 18h BRT (21h UTC)
  $$
  SELECT net.http_post(
    url := 'https://bfxahrrvoqxcdmfsvnrk.supabase.co/functions/v1/monitorar-andamentos',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJmeGFocnJ2b3F4Y2RtZnN2bnJrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyMjU0MDUsImV4cCI6MjA4MDgwMTQwNX0.bvVxZJYaaAIJXY4n9Gu3btoX5veywtNOSo79PFG6pQM"}'::jsonb,
    body := '{"completeRun": true}'::jsonb
  );
  $$
);

SELECT cron.schedule(
  'monitorar-andamentos-22h',
  '0 1 * * *', -- 22h BRT (01h UTC do dia seguinte)
  $$
  SELECT net.http_post(
    url := 'https://bfxahrrvoqxcdmfsvnrk.supabase.co/functions/v1/monitorar-andamentos',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJmeGFocnJ2b3F4Y2RtZnN2bnJrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyMjU0MDUsImV4cCI6MjA4MDgwMTQwNX0.bvVxZJYaaAIJXY4n9Gu3btoX5veywtNOSo79PFG6pQM"}'::jsonb,
    body := '{"completeRun": true}'::jsonb
  );
  $$
);

-- ================================================================
-- 3. MONITORAÇÃO 360 - TERMOS (2x ao dia: 8h e 18h BRT)
-- ================================================================

-- Remover jobs antigos se existirem
SELECT cron.unschedule('monitorar-termos-manha') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'monitorar-termos-manha'
);
SELECT cron.unschedule('monitorar-termos-tarde') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'monitorar-termos-tarde'
);

-- Criar jobs de termos (Monitoração 360)
SELECT cron.schedule(
  'monitorar-termos-manha',
  '0 11 * * *', -- 8h BRT (11h UTC)
  $$
  SELECT net.http_post(
    url := 'https://bfxahrrvoqxcdmfsvnrk.supabase.co/functions/v1/monitorar-termos',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJmeGFocnJ2b3F4Y2RtZnN2bnJrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyMjU0MDUsImV4cCI6MjA4MDgwMTQwNX0.bvVxZJYaaAIJXY4n9Gu3btoX5veywtNOSo79PFG6pQM"}'::jsonb,
    body := '{"completeRun": true}'::jsonb
  );
  $$
);

SELECT cron.schedule(
  'monitorar-termos-tarde',
  '0 21 * * *', -- 18h BRT (21h UTC)
  $$
  SELECT net.http_post(
    url := 'https://bfxahrrvoqxcdmfsvnrk.supabase.co/functions/v1/monitorar-termos',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJmeGFocnJ2b3F4Y2RtZnN2bnJrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyMjU0MDUsImV4cCI6MjA4MDgwMTQwNX0.bvVxZJYaaAIJXY4n9Gu3btoX5veywtNOSo79PFG6pQM"}'::jsonb,
    body := '{"completeRun": true}'::jsonb
  );
  $$
);

-- ================================================================
-- VERIFICAR TODOS OS JOBS CONFIGURADOS
-- ================================================================
SELECT jobid, jobname, schedule, active FROM cron.job ORDER BY jobname;
