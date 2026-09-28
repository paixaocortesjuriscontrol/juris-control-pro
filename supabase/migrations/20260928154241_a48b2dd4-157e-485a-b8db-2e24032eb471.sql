CREATE OR REPLACE FUNCTION public.validar_workflow_publicacao_processo()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.publicacao_origem_id IS NOT NULL AND NEW.processo_id IS NULL THEN
    RAISE EXCEPTION 'Workflow aberto a partir de publicação precisa de um processo.';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_validar_workflow_publicacao_processo ON public.workflow_execucoes;
CREATE TRIGGER trg_validar_workflow_publicacao_processo
BEFORE INSERT ON public.workflow_execucoes
FOR EACH ROW EXECUTE FUNCTION public.validar_workflow_publicacao_processo();