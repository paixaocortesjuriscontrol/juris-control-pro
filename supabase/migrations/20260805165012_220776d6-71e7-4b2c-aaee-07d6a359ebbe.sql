CREATE OR REPLACE FUNCTION public.bloquear_audiencia_automatica()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_coord UUID;
  v_permitido BOOLEAN;
BEGIN
  -- Somente audiências criadas pelos robôs de detecção podem ser bloqueadas.
  -- Qualquer outra origem (manual, publicação, importação, etc.) sempre grava.
  IF NEW.origem IS NULL OR NEW.origem NOT IN ('detectado', 'automatico', 'djen', 'robo') THEN
    RETURN NEW;
  END IF;

  v_coord := COALESCE(NEW.coordenacao_id, public.resolver_coord_processo(NEW.processo_id, NEW.processo_numero));

  IF v_coord IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT detectar_audiencias INTO v_permitido
  FROM public.config_deteccao_coordenacao
  WHERE coordenacao_id = v_coord;

  IF v_permitido IS DISTINCT FROM TRUE THEN
    RETURN NULL;
  END IF;

  RETURN NEW;
END;
$function$;