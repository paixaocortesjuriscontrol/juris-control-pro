-- Adicionar o cron job para processar alertas de parcelas (executa a cada 1 minuto)
SELECT cron.schedule(
  'processar-alertas-parcela',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://bfxahrrvoqxcdmfsvnrk.supabase.co/functions/v1/processar-alertas-parcela',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.supabase_service_role_key', true)
    ),
    body := '{"limit": 25}'::jsonb
  );
  $$
);