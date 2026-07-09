-- 1) Colunas
ALTER TABLE public.tarefas
  ADD COLUMN IF NOT EXISTS coordenacao_id uuid REFERENCES public.coordenacoes(id) ON DELETE SET NULL;

ALTER TABLE public.eventos_agenda
  ADD COLUMN IF NOT EXISTS coordenacao_id uuid REFERENCES public.coordenacoes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tarefas_coordenacao_id ON public.tarefas(coordenacao_id);
CREATE INDEX IF NOT EXISTS idx_eventos_agenda_coordenacao_id ON public.eventos_agenda(coordenacao_id);

-- 2) Função de derivação (compartilhada)
CREATE OR REPLACE FUNCTION public.sync_row_coordenacao_from_processo_or_criador()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_coord uuid;
  v_count int;
BEGIN
  IF NEW.processo_id IS NOT NULL THEN
    SELECT p.coordenacao_id INTO v_coord FROM public.processos p WHERE p.id = NEW.processo_id;
    IF v_coord IS NOT NULL THEN
      NEW.coordenacao_id := v_coord;
      RETURN NEW;
    END IF;
  END IF;

  IF NEW.coordenacao_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.criado_por IS NOT NULL THEN
    SELECT count(*) INTO v_count
      FROM public.membros_coordenacao m
     WHERE m.usuario_id = NEW.criado_por;
    IF v_count = 1 THEN
      SELECT m.coordenacao_id INTO v_coord
        FROM public.membros_coordenacao m
       WHERE m.usuario_id = NEW.criado_por
       LIMIT 1;
      NEW.coordenacao_id := v_coord;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- 3) Triggers
DROP TRIGGER IF EXISTS trg_tarefas_sync_coord ON public.tarefas;
CREATE TRIGGER trg_tarefas_sync_coord
BEFORE INSERT OR UPDATE OF processo_id, coordenacao_id, criado_por
ON public.tarefas
FOR EACH ROW
EXECUTE FUNCTION public.sync_row_coordenacao_from_processo_or_criador();

DROP TRIGGER IF EXISTS trg_eventos_agenda_sync_coord ON public.eventos_agenda;
CREATE TRIGGER trg_eventos_agenda_sync_coord
BEFORE INSERT OR UPDATE OF processo_id, coordenacao_id, criado_por
ON public.eventos_agenda
FOR EACH ROW
EXECUTE FUNCTION public.sync_row_coordenacao_from_processo_or_criador();

-- 4) Backfill: via processo
UPDATE public.tarefas t
   SET coordenacao_id = p.coordenacao_id
  FROM public.processos p
 WHERE t.coordenacao_id IS NULL
   AND t.processo_id = p.id
   AND p.coordenacao_id IS NOT NULL;

UPDATE public.eventos_agenda e
   SET coordenacao_id = p.coordenacao_id
  FROM public.processos p
 WHERE e.coordenacao_id IS NULL
   AND e.processo_id = p.id
   AND p.coordenacao_id IS NOT NULL;

-- 5) Backfill: única coordenação do criador (uuid via array_agg[1])
WITH criadores_unicos AS (
  SELECT usuario_id, (array_agg(coordenacao_id))[1] AS coordenacao_id
    FROM public.membros_coordenacao
   GROUP BY usuario_id
  HAVING COUNT(*) = 1
)
UPDATE public.tarefas t
   SET coordenacao_id = c.coordenacao_id
  FROM criadores_unicos c
 WHERE t.coordenacao_id IS NULL
   AND t.processo_id IS NULL
   AND t.criado_por = c.usuario_id;

WITH criadores_unicos AS (
  SELECT usuario_id, (array_agg(coordenacao_id))[1] AS coordenacao_id
    FROM public.membros_coordenacao
   GROUP BY usuario_id
  HAVING COUNT(*) = 1
)
UPDATE public.eventos_agenda e
   SET coordenacao_id = c.coordenacao_id
  FROM criadores_unicos c
 WHERE e.coordenacao_id IS NULL
   AND e.processo_id IS NULL
   AND e.criado_por = c.usuario_id;