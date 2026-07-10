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
  -- Cadastros humanos/importações assistidas sempre passam.
  -- O bloqueio abaixo é só para audiências criadas automaticamente por robôs.
  IF NEW.origem IS NULL OR NEW.origem IN ('manual', 'importacao', 'importado', 'pauta_excel') THEN
    RETURN NEW;
  END IF;

  v_coord := COALESCE(NEW.coordenacao_id, public.resolver_coord_processo(NEW.processo_id, NEW.processo_numero));

  -- Sem coordenação identificável, mantém o comportamento anterior.
  IF v_coord IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT detectar_audiencias INTO v_permitido
  FROM public.config_deteccao_coordenacao
  WHERE coordenacao_id = v_coord;

  IF v_permitido IS DISTINCT FROM TRUE THEN
    -- Robôs só podem gravar quando a detecção da coordenação está habilitada.
    RETURN NULL;
  END IF;

  RETURN NEW;
END;
$function$;