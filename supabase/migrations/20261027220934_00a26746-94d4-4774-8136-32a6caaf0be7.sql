CREATE OR REPLACE FUNCTION public.vincular_ata_processo_por_titulo()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _dig text; _ids uuid[];
BEGIN
  IF NEW.processo_id IS NULL AND upper(trim(coalesce(NEW.tipo_tarefa,''))) = 'ATA' THEN
    _dig := regexp_replace(substring(coalesce(NEW.titulo,'') from '\d{7}-?\d{2}\.?\d{4}\.?\d\.?\d{2}\.?\d{4}'),'[^0-9]','','g');
    IF _dig IS NOT NULL AND length(_dig) = 20 THEN
      SELECT array_agg(id) INTO _ids FROM (
        SELECT id FROM processos WHERE regexp_replace(numero,'[^0-9]','','g') = _dig LIMIT 2) s;
      IF array_length(_ids,1) = 1 THEN NEW.processo_id := _ids[1]; END IF;
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_vincular_ata_processo ON public.tarefas;
CREATE TRIGGER trg_vincular_ata_processo BEFORE INSERT OR UPDATE OF titulo, processo_id, tipo_tarefa ON public.tarefas
FOR EACH ROW EXECUTE FUNCTION public.vincular_ata_processo_por_titulo();