CREATE OR REPLACE FUNCTION public.disparar_alerta_servidor_travado()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.titulo LIKE 'DJEN Servidor:%' THEN
    BEGIN
      PERFORM net.http_post(
        url := 'https://bfxahrrvoqxcdmfsvnrk.supabase.co/functions/v1/alertar-servidor-travado',
        headers := jsonb_build_object('Content-Type','application/json',
          'Authorization','Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJmeGFocnJ2b3F4Y2RtZnN2bnJrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyMjU0MDUsImV4cCI6MjA4MDgwMTQwNX0.bvVxZJYaaAIJXY4n9Gu3btoX5veywtNOSo79PFG6pQM'),
        body := '{}'::jsonb, timeout_milliseconds := 30000);
    EXCEPTION WHEN OTHERS THEN NULL; END;
  END IF;
  RETURN NULL;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.disparar_alerta_servidor_travado() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_disparar_alerta_servidor_travado ON public.notificacoes;
CREATE TRIGGER trg_disparar_alerta_servidor_travado AFTER INSERT ON public.notificacoes
FOR EACH STATEMENT EXECUTE FUNCTION public.disparar_alerta_servidor_travado();