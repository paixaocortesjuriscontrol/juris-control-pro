CREATE OR REPLACE FUNCTION public.apagar_subatividades_do_item()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  DELETE FROM public.subatividades_item WHERE item_id = OLD.id;
  RETURN OLD;
END; $$;
DROP TRIGGER IF EXISTS trg_apagar_subatividades ON public.tarefas;
CREATE TRIGGER trg_apagar_subatividades AFTER DELETE ON public.tarefas FOR EACH ROW EXECUTE FUNCTION public.apagar_subatividades_do_item();
DROP TRIGGER IF EXISTS trg_apagar_subatividades ON public.eventos_agenda;
CREATE TRIGGER trg_apagar_subatividades AFTER DELETE ON public.eventos_agenda FOR EACH ROW EXECUTE FUNCTION public.apagar_subatividades_do_item();
DROP TRIGGER IF EXISTS trg_apagar_subatividades ON public.audiencias_detectadas;
CREATE TRIGGER trg_apagar_subatividades AFTER DELETE ON public.audiencias_detectadas FOR EACH ROW EXECUTE FUNCTION public.apagar_subatividades_do_item();