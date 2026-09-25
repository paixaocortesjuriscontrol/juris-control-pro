CREATE OR REPLACE FUNCTION public.normalizar_dossie_benner()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE m text;
BEGIN
  IF NEW.dossie IS NULL THEN RETURN NEW; END IF;
  NEW.dossie := btrim(NEW.dossie, E' \t\r\n');
  IF lower(NEW.dossie) ~ '^segredo' THEN
    NEW.dossie := NULL;
    RETURN NEW;
  END IF;
  m := substring(NEW.dossie from '^(\d{2}\.\d{2}\.\d{3}\.\d{6,12}/\d{2})(\s|$|\(|-)');
  IF m IS NOT NULL THEN NEW.dossie := m; END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_normalizar_dossie_benner ON public.dados_benner;
CREATE TRIGGER trg_normalizar_dossie_benner
BEFORE INSERT OR UPDATE OF dossie ON public.dados_benner
FOR EACH ROW EXECUTE FUNCTION public.normalizar_dossie_benner();