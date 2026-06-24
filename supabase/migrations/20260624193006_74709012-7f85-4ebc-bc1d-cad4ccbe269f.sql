-- Garantir que termos arquivados fiquem inativos automaticamente
CREATE OR REPLACE FUNCTION public.sync_monitoramento_djen_arquivado_ativo()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.arquivado = true THEN
    NEW.ativo := false;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_monitoramento_djen_arquivado_ativo ON public.monitoramentos_djen;
CREATE TRIGGER trg_sync_monitoramento_djen_arquivado_ativo
BEFORE INSERT OR UPDATE ON public.monitoramentos_djen
FOR EACH ROW EXECUTE FUNCTION public.sync_monitoramento_djen_arquivado_ativo();

-- Corrigir registros existentes inconsistentes (arquivado=true mas ativo=true)
UPDATE public.monitoramentos_djen
SET ativo = false
WHERE arquivado = true AND ativo = true;