CREATE OR REPLACE FUNCTION public.normalizar_numero_processo()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $fn$
DECLARE
  v_d text;
BEGIN
  IF NEW.numero IS NULL OR btrim(NEW.numero) = '' THEN
    RETURN NEW;
  END IF;

  v_d := regexp_replace(NEW.numero, '\D', '', 'g');
  IF length(v_d) = 20 THEN
    NEW.numero := substr(v_d,1,7) || '-' || substr(v_d,8,2) || '.' || substr(v_d,10,4) || '.' ||
                  substr(v_d,14,1) || '.' || substr(v_d,15,2) || '.' || substr(v_d,17,4);
  END IF;

  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_normalizar_numero_processo ON public.processos;
CREATE TRIGGER trg_normalizar_numero_processo
BEFORE INSERT OR UPDATE OF numero ON public.processos
FOR EACH ROW EXECUTE FUNCTION public.normalizar_numero_processo();