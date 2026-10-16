CREATE OR REPLACE FUNCTION public.sync_nome_etiqueta_cliente()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.nome IS DISTINCT FROM OLD.nome AND coalesce(trim(NEW.nome),'') <> '' THEN
    UPDATE public.etiquetas SET nome = NEW.nome, updated_at = now()
    WHERE cliente_id = NEW.id AND nome = OLD.nome;
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.sync_nome_etiqueta_cliente() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_sync_nome_etiqueta_cliente ON public.clientes;
CREATE TRIGGER trg_sync_nome_etiqueta_cliente AFTER UPDATE OF nome ON public.clientes
FOR EACH ROW EXECUTE FUNCTION public.sync_nome_etiqueta_cliente();