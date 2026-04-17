
-- Recria data_distribuicao como espelho de data_distribuicao_planilha
ALTER TABLE public.dados_benner ADD COLUMN IF NOT EXISTS data_distribuicao date;

-- Sincroniza valores atuais
UPDATE public.dados_benner SET data_distribuicao = data_distribuicao_planilha WHERE data_distribuicao IS NULL;

-- Trigger: qualquer mudança em data_distribuicao_planilha reflete em data_distribuicao (e vice-versa)
CREATE OR REPLACE FUNCTION public.sync_data_distribuicao_dados_benner()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    -- Se planilha mudou, espelhar em data_distribuicao
    IF NEW.data_distribuicao_planilha IS DISTINCT FROM COALESCE(OLD.data_distribuicao_planilha, NULL) THEN
      NEW.data_distribuicao := NEW.data_distribuicao_planilha;
    -- Se data_distribuicao mudou (legacy) e planilha não foi explicitamente mudada, espelhar inverso
    ELSIF NEW.data_distribuicao IS DISTINCT FROM COALESCE(OLD.data_distribuicao, NULL) THEN
      NEW.data_distribuicao_planilha := NEW.data_distribuicao;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_data_distribuicao_dados_benner ON public.dados_benner;
CREATE TRIGGER trg_sync_data_distribuicao_dados_benner
BEFORE INSERT OR UPDATE ON public.dados_benner
FOR EACH ROW EXECUTE FUNCTION public.sync_data_distribuicao_dados_benner();
