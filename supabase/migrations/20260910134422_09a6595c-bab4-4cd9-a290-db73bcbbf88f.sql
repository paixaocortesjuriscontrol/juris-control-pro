CREATE OR REPLACE FUNCTION public.trg_aplicar_etiquetas_cliente_processo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.cliente_id IS NOT NULL THEN
    PERFORM public.aplicar_etiquetas_cliente_processo(NEW.id, NULL);
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS aplicar_etiquetas_cliente_processo_ins ON public.processos;
CREATE TRIGGER aplicar_etiquetas_cliente_processo_ins
AFTER INSERT ON public.processos
FOR EACH ROW EXECUTE FUNCTION public.trg_aplicar_etiquetas_cliente_processo();

DROP TRIGGER IF EXISTS aplicar_etiquetas_cliente_processo_upd ON public.processos;
CREATE TRIGGER aplicar_etiquetas_cliente_processo_upd
AFTER UPDATE OF cliente_id ON public.processos
FOR EACH ROW
WHEN (NEW.cliente_id IS DISTINCT FROM OLD.cliente_id)
EXECUTE FUNCTION public.trg_aplicar_etiquetas_cliente_processo();