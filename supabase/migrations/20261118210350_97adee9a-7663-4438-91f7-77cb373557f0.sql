CREATE OR REPLACE FUNCTION public.set_acompanhamento_ativado_em()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $f$
BEGIN
  IF NEW.acompanhamento_especial IS TRUE AND NEW.acompanhamento_ativado_em IS NULL
     AND (TG_OP = 'INSERT' OR OLD.acompanhamento_especial IS DISTINCT FROM TRUE OR OLD.acompanhamento_ativado_em IS NOT NULL) THEN
    NEW.acompanhamento_ativado_em := now();
  END IF;
  RETURN NEW;
END $f$;

DROP TRIGGER IF EXISTS trg_set_acompanhamento_ativado_em ON public.processos;
CREATE TRIGGER trg_set_acompanhamento_ativado_em BEFORE INSERT OR UPDATE OF acompanhamento_especial, acompanhamento_ativado_em ON public.processos
FOR EACH ROW EXECUTE FUNCTION public.set_acompanhamento_ativado_em();

UPDATE public.processos p SET acompanhamento_ativado_em = x.dt
FROM (
  SELECT ei.entidade_id, min(ei.created_at) dt
  FROM public.etiquetas_itens ei JOIN public.etiquetas e ON e.id = ei.etiqueta_id
  WHERE upper(trim(e.nome)) = 'CAPTURA'
  GROUP BY ei.entidade_id
) x
WHERE x.entidade_id = p.id AND p.acompanhamento_especial IS TRUE AND p.acompanhamento_ativado_em IS NULL;