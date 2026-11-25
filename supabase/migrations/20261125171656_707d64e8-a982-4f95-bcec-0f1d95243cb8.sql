ALTER TABLE public.config_acompanhamento_especial ADD COLUMN IF NOT EXISTS email_unico text;
CREATE OR REPLACE FUNCTION public.validar_email_unico_acomp() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  NEW.email_unico := nullif(lower(trim(NEW.email_unico)),'');
  IF NEW.email_unico IS NOT NULL AND NEW.email_unico !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RAISE EXCEPTION 'E-mail único inválido: %', NEW.email_unico;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_validar_email_unico_acomp ON public.config_acompanhamento_especial;
CREATE TRIGGER trg_validar_email_unico_acomp BEFORE INSERT OR UPDATE ON public.config_acompanhamento_especial FOR EACH ROW EXECUTE FUNCTION public.validar_email_unico_acomp();