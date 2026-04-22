-- 1) Backfill: preenche coordenacao_id em audiencias_detectadas a partir do processo vinculado
UPDATE public.audiencias_detectadas a
SET coordenacao_id = p.coordenacao_id
FROM public.processos p
WHERE a.processo_id = p.id
  AND a.coordenacao_id IS DISTINCT FROM p.coordenacao_id
  AND p.coordenacao_id IS NOT NULL;

-- 2) Trigger: garante que coordenacao_id seja preenchida automaticamente
CREATE OR REPLACE FUNCTION public.set_audiencia_coordenacao_from_processo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Se não veio coordenacao_id mas há processo, herda do processo
  IF NEW.coordenacao_id IS NULL AND NEW.processo_id IS NOT NULL THEN
    SELECT p.coordenacao_id INTO NEW.coordenacao_id
    FROM public.processos p
    WHERE p.id = NEW.processo_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audiencia_set_coordenacao ON public.audiencias_detectadas;

CREATE TRIGGER trg_audiencia_set_coordenacao
BEFORE INSERT OR UPDATE OF processo_id, coordenacao_id ON public.audiencias_detectadas
FOR EACH ROW
EXECUTE FUNCTION public.set_audiencia_coordenacao_from_processo();