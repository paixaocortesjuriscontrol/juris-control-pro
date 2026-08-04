CREATE OR REPLACE FUNCTION public.set_descartado_por_publicacao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_nome text;
BEGIN
  IF NEW.descartado_por IS NULL AND v_uid IS NOT NULL THEN
    NEW.descartado_por := v_uid;
  END IF;

  IF NEW.descartado_por_nome IS NULL OR TRIM(NEW.descartado_por_nome) = '' THEN
    IF NEW.descartado_por IS NOT NULL THEN
      SELECT COALESCE(NULLIF(TRIM(p.nome), ''), p.email)
        INTO v_nome
      FROM public.profiles p
      WHERE p.id = NEW.descartado_por;

      v_nome := COALESCE(v_nome, 'Usuário');

      IF COALESCE(NEW.motivo_descarte, '') NOT IN ('descartado_manualmente', 'descarte_manual') THEN
        v_nome := v_nome || ' (motor automático)';
      END IF;

      NEW.descartado_por_nome := v_nome;
    ELSE
      NEW.descartado_por_nome := 'Sistema (servidor)';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_descartado_por ON public.publicacoes_djen_descartadas;
CREATE TRIGGER trg_set_descartado_por
BEFORE INSERT ON public.publicacoes_djen_descartadas
FOR EACH ROW
EXECUTE FUNCTION public.set_descartado_por_publicacao();