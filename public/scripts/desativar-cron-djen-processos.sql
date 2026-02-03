-- =============================================================================
-- DESATIVAR CRON JOBS DO DJEN PROCESSOS
-- =============================================================================
-- Execute este script no SQL Editor do Supabase para remover os agendamentos
-- automáticos do DJEN Processos.
-- 
-- O DJEN Processos agora é executado APENAS no navegador (browser-only) para
-- evitar o erro WORKER_LIMIT (546) que ocorria com Edge Functions em alto volume.
-- =============================================================================

-- Remove todos os jobs relacionados ao DJEN Processos
SELECT cron.unschedule('monitorar-djen-processos-manha');
SELECT cron.unschedule('monitorar-djen-processos-tarde');
SELECT cron.unschedule('monitorar-djen-processos-diario');
SELECT cron.unschedule('monitorar-djen-processos');

-- Verifica se ainda existe algum job do DJEN Processos
SELECT jobname, schedule, command 
FROM cron.job 
WHERE jobname LIKE '%djen-processos%';
