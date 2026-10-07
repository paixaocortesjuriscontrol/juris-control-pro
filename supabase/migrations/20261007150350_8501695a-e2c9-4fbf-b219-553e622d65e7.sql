CREATE TABLE public.pje_direto_cron_token (id int PRIMARY KEY DEFAULT 1, token text NOT NULL DEFAULT encode(gen_random_bytes(24),'hex'));
GRANT ALL ON public.pje_direto_cron_token TO service_role;
ALTER TABLE public.pje_direto_cron_token ENABLE ROW LEVEL SECURITY;
INSERT INTO public.pje_direto_cron_token DEFAULT VALUES;
SELECT cron.schedule('buscar-pje-direto-termos', '0 14 * * *', $c$
  SELECT net.http_post(
    url := 'https://bfxahrrvoqxcdmfsvnrk.supabase.co/functions/v1/buscar-pje-direto',
    headers := jsonb_build_object('Content-Type','application/json',
      'Authorization','Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJmeGFocnJ2b3F4Y2RtZnN2bnJrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyMjU0MDUsImV4cCI6MjA4MDgwMTQwNX0.bvVxZJYaaAIJXY4n9Gu3btoX5veywtNOSo79PFG6pQM',
      'x-cron-token', (SELECT token FROM public.pje_direto_cron_token LIMIT 1)),
    body := '{"acao":"buscar_todos"}'::jsonb,
    timeout_milliseconds := 300000);
$c$);