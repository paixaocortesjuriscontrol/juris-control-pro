CREATE OR REPLACE FUNCTION public.prevent_duplicate_tarefas()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  existing_id UUID;
BEGIN
  IF NEW.origem IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.origem IN ('astrea','projuris','pauta_excel','importacao','planilha','workflow') THEN
    RETURN NEW;
  END IF;

  IF NEW.criado_por IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT id INTO existing_id
  FROM tarefas
  WHERE
    criado_por = NEW.criado_por
    AND LOWER(TRIM(titulo)) = LOWER(TRIM(NEW.titulo))
    AND COALESCE(data_vencimento, data_fatal) = COALESCE(NEW.data_vencimento, NEW.data_fatal)
    AND COALESCE(processo_id::text, '') = COALESCE(NEW.processo_id::text, '')
    AND COALESCE(responsavel_id::text, '') = COALESCE(NEW.responsavel_id::text, '')
    AND COALESCE(tipo_tarefa, '') = COALESCE(NEW.tipo_tarefa, '')
    AND created_at >= NOW() - INTERVAL '60 days'
  LIMIT 1;

  IF existing_id IS NOT NULL THEN
    RAISE EXCEPTION 'Você já criou esta mesma tarefa. Verifique sua lista antes de cadastrar novamente.'
      USING ERRCODE = 'unique_violation';
  END IF;

  RETURN NEW;
END;
$$;