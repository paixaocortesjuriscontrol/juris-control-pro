CREATE OR REPLACE FUNCTION public.log_reagendamento_audiencia()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hora_ant text;
  v_hora_nova text;
BEGIN
  v_hora_ant := COALESCE(OLD.hora, OLD.hora_local, OLD.hora_brasilia);
  v_hora_nova := COALESCE(NEW.hora, NEW.hora_local, NEW.hora_brasilia);

  IF (NEW.data_audiencia IS DISTINCT FROM OLD.data_audiencia)
     OR (v_hora_nova IS DISTINCT FROM v_hora_ant)
     OR (NEW.tipo_audiencia IS DISTINCT FROM OLD.tipo_audiencia)
     OR (NEW.modalidade IS DISTINCT FROM OLD.modalidade) THEN

    -- evita duplicar quando o registro já foi gravado pelo fluxo "Reagendar"
    IF EXISTS (
      SELECT 1 FROM public.historico_reagendamentos_audiencia h
      WHERE h.audiencia_id = NEW.id
        AND h.alterado_em > now() - interval '15 seconds'
        AND h.data_nova IS NOT DISTINCT FROM NEW.data_audiencia
    ) THEN
      RETURN NEW;
    END IF;

    INSERT INTO public.historico_reagendamentos_audiencia (
      audiencia_id, data_anterior, data_nova, hora_anterior, hora_nova,
      tipo_anterior, tipo_novo, modalidade_anterior, modalidade_nova,
      motivo, alterado_por
    ) VALUES (
      NEW.id, OLD.data_audiencia, NEW.data_audiencia, v_hora_ant, v_hora_nova,
      OLD.tipo_audiencia, NEW.tipo_audiencia, OLD.modalidade, NEW.modalidade,
      'Alteração registrada automaticamente', auth.uid()
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_reagendamento_audiencia ON public.audiencias_detectadas;
CREATE TRIGGER trg_log_reagendamento_audiencia
AFTER UPDATE ON public.audiencias_detectadas
FOR EACH ROW
EXECUTE FUNCTION public.log_reagendamento_audiencia();