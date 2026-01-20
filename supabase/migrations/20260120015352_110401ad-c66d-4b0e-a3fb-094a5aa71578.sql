
-- Limpar registros de hoje para teste limpo
DELETE FROM djen_lotes WHERE created_at::date = CURRENT_DATE;
DELETE FROM djen_runs WHERE iniciado_em::date = CURRENT_DATE;
DELETE FROM publicacoes_djen_global_hash WHERE created_at::date = CURRENT_DATE;
DELETE FROM historico_monitoramento WHERE tipo = 'djen' AND executado_em::date = CURRENT_DATE;

-- Resetar offset no metadata
UPDATE configuracoes_monitoramento 
SET metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{next_offset}', '0')
WHERE tipo = 'djen';

-- Atualizar o cron monitorar-djen-manha para 22:55 BRT (01:55 UTC)
SELECT cron.unschedule('monitorar-djen-manha');

SELECT cron.schedule(
  'monitorar-djen-teste-2255',
  '55 1 * * *',
  $$
  SELECT net.http_post(
    url:='https://bfxahrrvoqxcdmfsvnrk.supabase.co/functions/v1/monitorar-djen',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJmeGFocnJ2b3F4Y2RtZnN2bnJrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyMjU0MDUsImV4cCI6MjA4MDgwMTQwNX0.bvVxZJYaaAIJXY4n9Gu3btoX5veywtNOSo79PFG6pQM"}'::jsonb,
    body:='{"scheduled": true, "completeRun": true}'::jsonb
  ) AS request_id;
  $$
);
