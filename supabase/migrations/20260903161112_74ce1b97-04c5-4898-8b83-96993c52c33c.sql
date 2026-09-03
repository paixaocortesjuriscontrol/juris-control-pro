CREATE OR REPLACE FUNCTION public.aplicar_fixos_audiencia()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cfg RECORD;
BEGIN
  IF NEW.coordenacao_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT responsaveis, envolvidos INTO cfg
  FROM public.responsaveis_fixos_tipo_tarefa
  WHERE coordenacao_id = NEW.coordenacao_id
    AND tipo_tarefa = 'AUDIÊNCIA'
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  IF cfg.responsaveis IS NOT NULL THEN
    INSERT INTO public.audiencias_advogados (audiencia_id, advogado_id)
    SELECT NEW.id, uid
    FROM unnest(cfg.responsaveis) AS uid
    WHERE uid IS NOT NULL
      AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = uid)
    ON CONFLICT (audiencia_id, advogado_id) DO NOTHING;
  END IF;

  IF cfg.envolvidos IS NOT NULL THEN
    INSERT INTO public.audiencia_envolvidos (audiencia_id, usuario_id)
    SELECT NEW.id, uid
    FROM unnest(cfg.envolvidos) AS uid
    WHERE uid IS NOT NULL
      AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = uid)
    ON CONFLICT (audiencia_id, usuario_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_aplicar_fixos_audiencia ON public.audiencias_detectadas;
CREATE TRIGGER trg_aplicar_fixos_audiencia
AFTER INSERT ON public.audiencias_detectadas
FOR EACH ROW EXECUTE FUNCTION public.aplicar_fixos_audiencia();