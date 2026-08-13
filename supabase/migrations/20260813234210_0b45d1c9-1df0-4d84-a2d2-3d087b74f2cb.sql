-- 1) Dedupe + unicidade
DELETE FROM public.etiquetas_itens a
USING public.etiquetas_itens b
WHERE a.ctid > b.ctid
  AND a.etiqueta_id = b.etiqueta_id
  AND a.entidade = b.entidade
  AND a.entidade_id = b.entidade_id;

CREATE UNIQUE INDEX IF NOT EXISTS etiquetas_itens_unico
  ON public.etiquetas_itens (entidade, entidade_id, etiqueta_id);

-- 2) Replicação processo -> itens
CREATE OR REPLACE FUNCTION public.replicar_etiqueta_processo(
  _etiqueta_id uuid,
  _processo_id uuid,
  _aplicar boolean,
  _created_by uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _etiqueta_id IS NULL OR _processo_id IS NULL THEN
    RETURN;
  END IF;

  IF _aplicar THEN
    -- garante que a etiqueta apareça no módulo de itens
    UPDATE public.etiquetas
       SET modulos = array_append(modulos, 'itens')
     WHERE id = _etiqueta_id
       AND NOT ('itens' = ANY (COALESCE(modulos, ARRAY[]::text[])));

    -- tarefas (prazos / tarefas / audiências-tarefa / parcelamentos legados)
    INSERT INTO public.etiquetas_itens (etiqueta_id, entidade, entidade_id, created_by)
    SELECT _etiqueta_id, e.entidade, t.id, _created_by
      FROM public.tarefas t
      CROSS JOIN LATERAL (
        SELECT unnest(ARRAY[
          'tarefa',
          CASE upper(btrim(COALESCE(t.tipo_tarefa, '')))
            WHEN 'PRAZO' THEN 'prazo'
            WHEN 'AUDIÊNCIA' THEN 'audiencia'
            WHEN 'AUDIENCIA' THEN 'audiencia'
            WHEN 'EVENTO' THEN 'evento'
            WHEN 'PARCELAMENTO' THEN 'parcelamento'
            WHEN 'PARCELAMENTO_RECORRENTE' THEN 'parcelamento'
            ELSE 'tarefa'
          END
        ]) AS entidade
      ) e
     WHERE t.processo_id = _processo_id
    ON CONFLICT (entidade, entidade_id, etiqueta_id) DO NOTHING;

    -- eventos da agenda (eventos e parcelamentos)
    INSERT INTO public.etiquetas_itens (etiqueta_id, entidade, entidade_id, created_by)
    SELECT _etiqueta_id, e.entidade, ev.id, _created_by
      FROM public.eventos_agenda ev
      CROSS JOIN LATERAL (
        SELECT unnest(ARRAY[
          'evento',
          CASE upper(btrim(COALESCE(ev.tipo, '')))
            WHEN 'PARCELAMENTO' THEN 'parcelamento'
            WHEN 'PARCELAMENTO_RECORRENTE' THEN 'parcelamento'
            ELSE 'evento'
          END
        ]) AS entidade
      ) e
     WHERE ev.processo_id = _processo_id
    ON CONFLICT (entidade, entidade_id, etiqueta_id) DO NOTHING;

    -- audiências detectadas
    INSERT INTO public.etiquetas_itens (etiqueta_id, entidade, entidade_id, created_by)
    SELECT _etiqueta_id, 'audiencia', a.id, _created_by
      FROM public.audiencias_detectadas a
     WHERE a.processo_id = _processo_id
    ON CONFLICT (entidade, entidade_id, etiqueta_id) DO NOTHING;
  ELSE
    DELETE FROM public.etiquetas_itens ei
     WHERE ei.etiqueta_id = _etiqueta_id
       AND ei.entidade <> 'processo'
       AND (
         ei.entidade_id IN (SELECT id FROM public.tarefas WHERE processo_id = _processo_id)
         OR ei.entidade_id IN (SELECT id FROM public.eventos_agenda WHERE processo_id = _processo_id)
         OR ei.entidade_id IN (SELECT id FROM public.audiencias_detectadas WHERE processo_id = _processo_id)
       );
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_etiqueta_processo_replicar()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.entidade = 'processo' THEN
      PERFORM public.replicar_etiqueta_processo(NEW.etiqueta_id, NEW.entidade_id, true, NEW.created_by);
    END IF;
    RETURN NEW;
  ELSE
    IF OLD.entidade = 'processo' THEN
      PERFORM public.replicar_etiqueta_processo(OLD.etiqueta_id, OLD.entidade_id, false, NULL);
    END IF;
    RETURN OLD;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS trg_etiqueta_processo_replicar_ins ON public.etiquetas_itens;
CREATE TRIGGER trg_etiqueta_processo_replicar_ins
AFTER INSERT ON public.etiquetas_itens
FOR EACH ROW EXECUTE FUNCTION public.trg_etiqueta_processo_replicar();

DROP TRIGGER IF EXISTS trg_etiqueta_processo_replicar_del ON public.etiquetas_itens;
CREATE TRIGGER trg_etiqueta_processo_replicar_del
AFTER DELETE ON public.etiquetas_itens
FOR EACH ROW EXECUTE FUNCTION public.trg_etiqueta_processo_replicar();

-- 3) Novos itens herdam as etiquetas do processo
CREATE OR REPLACE FUNCTION public.trg_item_herdar_etiquetas_processo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
BEGIN
  IF NEW.processo_id IS NULL THEN
    RETURN NEW;
  END IF;
  FOR r IN
    SELECT etiqueta_id FROM public.etiquetas_itens
     WHERE entidade = 'processo' AND entidade_id = NEW.processo_id
  LOOP
    PERFORM public.replicar_etiqueta_processo(r.etiqueta_id, NEW.processo_id, true, NULL);
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tarefas_herdar_etiquetas ON public.tarefas;
CREATE TRIGGER trg_tarefas_herdar_etiquetas
AFTER INSERT ON public.tarefas
FOR EACH ROW EXECUTE FUNCTION public.trg_item_herdar_etiquetas_processo();

DROP TRIGGER IF EXISTS trg_eventos_herdar_etiquetas ON public.eventos_agenda;
CREATE TRIGGER trg_eventos_herdar_etiquetas
AFTER INSERT ON public.eventos_agenda
FOR EACH ROW EXECUTE FUNCTION public.trg_item_herdar_etiquetas_processo();

DROP TRIGGER IF EXISTS trg_audiencias_herdar_etiquetas ON public.audiencias_detectadas
;
CREATE TRIGGER trg_audiencias_herdar_etiquetas
AFTER INSERT ON public.audiencias_detectadas
FOR EACH ROW EXECUTE FUNCTION public.trg_item_herdar_etiquetas_processo();

-- 4) Backfill das etiquetas já aplicadas em processos
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT etiqueta_id, entidade_id FROM public.etiquetas_itens WHERE entidade = 'processo' LOOP
    PERFORM public.replicar_etiqueta_processo(r.etiqueta_id, r.entidade_id, true, NULL);
  END LOOP;
END $$;