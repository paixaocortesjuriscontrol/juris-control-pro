-- ============================================================
-- SCRIPT ATUALIZADO DE CRON JOBS V2 - MONITORAMENTOS ROBUSTOS
-- ============================================================
-- Execute este script no SQL Editor do Supabase Dashboard
-- Os horários estão em UTC (BRT + 3 horas)
-- 
-- HORÁRIOS BRT → UTC:
--   09h BRT = 12h UTC
--   18h BRT = 21h UTC
-- ============================================================

-- 1. DESABILITAR JOBS ANTIGOS (manter para referência mas desativar)
-- ============================================================

-- Redistribuições
SELECT cron.unschedule('monitorar-redistribuicoes-manha');
SELECT cron.unschedule('monitorar-redistribuicoes-tarde');
SELECT cron.unschedule('monitorar-redistribuicoes-completo');
SELECT cron.unschedule('monitorar-redistribuicoes');

-- Andamentos  
SELECT cron.unschedule('monitorar-andamentos-manha');
SELECT cron.unschedule('monitorar-andamentos-tarde');
SELECT cron.unschedule('monitorar-andamentos-completo');
SELECT cron.unschedule('monitorar-andamentos');

-- Distribuições
SELECT cron.unschedule('monitorar-distribuicoes-manha');
SELECT cron.unschedule('monitorar-distribuicoes-tarde');
SELECT cron.unschedule('monitorar-distribuicoes-completo');
SELECT cron.unschedule('monitorar-distribuicoes');

-- Termos/360
SELECT cron.unschedule('monitorar-termos-manha');
SELECT cron.unschedule('monitorar-termos-tarde');
SELECT cron.unschedule('monitorar-termos-completo');
SELECT cron.unschedule('monitorar-termos');

-- DJEN (vamos manter desativado pois será via RPA)
SELECT cron.unschedule('monitorar-djen-manha');
SELECT cron.unschedule('monitorar-djen-tarde');
SELECT cron.unschedule('monitorar-djen-meio');
SELECT cron.unschedule('monitorar-djen');

-- DJEN Processos (vamos manter desativado pois será via RPA)
SELECT cron.unschedule('monitorar-djen-processos-manha');
SELECT cron.unschedule('monitorar-djen-processos-tarde');
SELECT cron.unschedule('monitorar-djen-processos');

-- Limpeza
SELECT cron.unschedule('limpar-execucoes-antigas');


-- 2. AGENDAR NOVOS JOBS ROBUSTOS (via executar-monitoramento wrapper)
-- ============================================================

-- REDISTRIBUIÇÕES: 09h e 18h BRT
SELECT cron.schedule(
  'exec-redistribuicoes-manha',
  '0 12 * * *',
  $$
  SELECT net.http_post(
    url := 'https://bfxahrrvoqxcdmfsvnrk.supabase.co/functions/v1/executar-monitoramento',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJmeGFocnJ2b3F4Y2RtZnN2bnJrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyMjU0MDUsImV4cCI6MjA4MDgwMTQwNX0.bvVxZJYaaAIJXY4n9Gu3btoX5veywtNOSo79PFG6pQM"}'::jsonb,
    body := '{"tipo": "redistribuicoes", "scheduled": true, "jobName": "cron-redistribuicoes-manha"}'::jsonb
  ) AS request_id;
  $$
);

SELECT cron.schedule(
  'exec-redistribuicoes-tarde',
  '0 21 * * *',
  $$
  SELECT net.http_post(
    url := 'https://bfxahrrvoqxcdmfsvnrk.supabase.co/functions/v1/executar-monitoramento',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJmeGFocnJ2b3F4Y2RtZnN2bnJrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyMjU0MDUsImV4cCI6MjA4MDgwMTQwNX0.bvVxZJYaaAIJXY4n9Gu3btoX5veywtNOSo79PFG6pQM"}'::jsonb,
    body := '{"tipo": "redistribuicoes", "scheduled": true, "jobName": "cron-redistribuicoes-tarde"}'::jsonb
  ) AS request_id;
  $$
);

-- ANDAMENTOS: 09h e 18h BRT
SELECT cron.schedule(
  'exec-andamentos-manha',
  '0 12 * * *',
  $$
  SELECT net.http_post(
    url := 'https://bfxahrrvoqxcdmfsvnrk.supabase.co/functions/v1/executar-monitoramento',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJmeGFocnJ2b3F4Y2RtZnN2bnJrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyMjU0MDUsImV4cCI6MjA4MDgwMTQwNX0.bvVxZJYaaAIJXY4n9Gu3btoX5veywtNOSo79PFG6pQM"}'::jsonb,
    body := '{"tipo": "andamentos", "scheduled": true, "jobName": "cron-andamentos-manha"}'::jsonb
  ) AS request_id;
  $$
);

SELECT cron.schedule(
  'exec-andamentos-tarde',
  '0 21 * * *',
  $$
  SELECT net.http_post(
    url := 'https://bfxahrrvoqxcdmfsvnrk.supabase.co/functions/v1/executar-monitoramento',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJmeGFocnJ2b3F4Y2RtZnN2bnJrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyMjU0MDUsImV4cCI6MjA4MDgwMTQwNX0.bvVxZJYaaAIJXY4n9Gu3btoX5veywtNOSo79PFG6pQM"}'::jsonb,
    body := '{"tipo": "andamentos", "scheduled": true, "jobName": "cron-andamentos-tarde"}'::jsonb
  ) AS request_id;
  $$
);

-- DISTRIBUIÇÕES: 09h e 18h BRT
SELECT cron.schedule(
  'exec-distribuicoes-manha',
  '0 12 * * *',
  $$
  SELECT net.http_post(
    url := 'https://bfxahrrvoqxcdmfsvnrk.supabase.co/functions/v1/executar-monitoramento',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJmeGFocnJ2b3F4Y2RtZnN2bnJrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyMjU0MDUsImV4cCI6MjA4MDgwMTQwNX0.bvVxZJYaaAIJXY4n9Gu3btoX5veywtNOSo79PFG6pQM"}'::jsonb,
    body := '{"tipo": "distribuicoes", "scheduled": true, "jobName": "cron-distribuicoes-manha"}'::jsonb
  ) AS request_id;
  $$
);

SELECT cron.schedule(
  'exec-distribuicoes-tarde',
  '0 21 * * *',
  $$
  SELECT net.http_post(
    url := 'https://bfxahrrvoqxcdmfsvnrk.supabase.co/functions/v1/executar-monitoramento',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJmeGFocnJ2b3F4Y2RtZnN2bnJrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyMjU0MDUsImV4cCI6MjA4MDgwMTQwNX0.bvVxZJYaaAIJXY4n9Gu3btoX5veywtNOSo79PFG6pQM"}'::jsonb,
    body := '{"tipo": "distribuicoes", "scheduled": true, "jobName": "cron-distribuicoes-tarde"}'::jsonb
  ) AS request_id;
  $$
);

-- MONITORAÇÃO 360 (TERMOS): 09h e 18h BRT
SELECT cron.schedule(
  'exec-termos-manha',
  '0 12 * * *',
  $$
  SELECT net.http_post(
    url := 'https://bfxahrrvoqxcdmfsvnrk.supabase.co/functions/v1/executar-monitoramento',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJmeGFocnJ2b3F4Y2RtZnN2bnJrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyMjU0MDUsImV4cCI6MjA4MDgwMTQwNX0.bvVxZJYaaAIJXY4n9Gu3btoX5veywtNOSo79PFG6pQM"}'::jsonb,
    body := '{"tipo": "termos", "scheduled": true, "jobName": "cron-termos-manha"}'::jsonb
  ) AS request_id;
  $$
);

SELECT cron.schedule(
  'exec-termos-tarde',
  '0 21 * * *',
  $$
  SELECT net.http_post(
    url := 'https://bfxahrrvoqxcdmfsvnrk.supabase.co/functions/v1/executar-monitoramento',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJmeGFocnJ2b3F4Y2RtZnN2bnJrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyMjU0MDUsImV4cCI6MjA4MDgwMTQwNX0.bvVxZJYaaAIJXY4n9Gu3btoX5veywtNOSo79PFG6pQM"}'::jsonb,
    body := '{"tipo": "termos", "scheduled": true, "jobName": "cron-termos-tarde"}'::jsonb
  ) AS request_id;
  $$
);


-- 3. LIMPEZA AUTOMÁTICA DE EXECUÇÕES ANTIGAS (03h UTC = 00h BRT)
-- ============================================================
SELECT cron.schedule(
  'limpar-execucoes-antigas',
  '0 3 * * *',
  $$SELECT public.limpar_execucoes_antigas()$$
);


-- 4. JOBS AUXILIARES (manter os existentes)
-- ============================================================

-- Alertas de audiências (10h BRT = 13h UTC)
-- SELECT cron.schedule(
--   'alertar-audiencias-diario',
--   '0 13 * * *',
--   $$ ... $$
-- );

-- Processar alertas DJEN coordenação (a cada minuto)
-- SELECT cron.schedule(
--   'processar-alertas-djen-coordenacao',
--   '* * * * *',
--   $$ ... $$
-- );


-- 5. VERIFICAR JOBS CONFIGURADOS
-- ============================================================
SELECT 
  jobid, 
  jobname, 
  schedule, 
  active,
  CASE 
    WHEN schedule LIKE '0 12 %' THEN '09h BRT'
    WHEN schedule LIKE '0 21 %' THEN '18h BRT'
    WHEN schedule LIKE '0 3 %' THEN '00h BRT'
    WHEN schedule LIKE '0 13 %' THEN '10h BRT'
    WHEN schedule = '* * * * *' THEN 'A cada minuto'
    ELSE schedule
  END as horario_brt
FROM cron.job 
WHERE jobname LIKE 'exec-%' 
   OR jobname LIKE 'limpar-%'
   OR jobname LIKE 'alertar-%'
   OR jobname LIKE 'processar-alertas-%'
ORDER BY jobname;


-- 6. VERIFICAR ÚLTIMAS EXECUÇÕES DOS JOBS
-- ============================================================
-- SELECT 
--   jobid,
--   runid,
--   job_pid,
--   status,
--   start_time AT TIME ZONE 'America/Sao_Paulo' as inicio_brt,
--   end_time AT TIME ZONE 'America/Sao_Paulo' as fim_brt
-- FROM cron.job_run_details
-- WHERE start_time > now() - interval '24 hours'
-- ORDER BY start_time DESC
-- LIMIT 50;
