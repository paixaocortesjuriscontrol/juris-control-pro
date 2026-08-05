CREATE OR REPLACE FUNCTION public.set_processo_coordenacao_autor()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_coord uuid;
BEGIN
  IF NEW.coordenacao_id IS NOT NULL OR v_user IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT coordenacao_id INTO v_coord
  FROM public.membros_coordenacao
  WHERE usuario_id = v_user
  LIMIT 1;

  IF v_coord IS NULL THEN
    SELECT id INTO v_coord
    FROM public.coordenacoes
    WHERE coordenador_id = v_user
    LIMIT 1;
  END IF;

  IF v_coord IS NOT NULL THEN
    NEW.coordenacao_id := v_coord;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_set_processo_coordenacao_autor ON public.processos;
CREATE TRIGGER trg_set_processo_coordenacao_autor
BEFORE INSERT ON public.processos
FOR EACH ROW
EXECUTE FUNCTION public.set_processo_coordenacao_autor();