-- Função para bloquear duplicidades apenas em tarefas automáticas/importadas
CREATE OR REPLACE FUNCTION public.prevent_duplicate_tarefas()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  existing_id UUID;
BEGIN
  -- Só verifica duplicidade para tarefas automáticas (origem preenchida)
  -- Tarefas manuais (origem IS NULL) podem ser criadas livremente
  IF NEW.origem IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Busca tarefa existente com mesma chave de negócio nos últimos 60 dias
  SELECT id INTO existing_id
  FROM tarefas
  WHERE 
    -- Chave de negócio: título normalizado + data + processo + responsável + tipo
    LOWER(TRIM(titulo)) = LOWER(TRIM(NEW.titulo))
    AND COALESCE(data_vencimento, data_fatal) = COALESCE(NEW.data_vencimento, NEW.data_fatal)
    AND COALESCE(processo_id::text, '') = COALESCE(NEW.processo_id::text, '')
    AND COALESCE(responsavel_id::text, '') = COALESCE(NEW.responsavel_id::text, '')
    AND COALESCE(tipo_tarefa, '') = COALESCE(NEW.tipo_tarefa, '')
    -- Só bloqueia tarefas recentes (evita conflito com dados históricos)
    AND created_at >= NOW() - INTERVAL '60 days'
  LIMIT 1;
  
  -- Se encontrou duplicata, bloqueia a inserção
  IF existing_id IS NOT NULL THEN
    RAISE EXCEPTION 'Tarefa duplicada detectada. Já existe uma tarefa similar (ID: %) com mesmo título, data, processo, responsável e tipo.', existing_id
      USING ERRCODE = 'unique_violation';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Remove trigger antigo se existir
DROP TRIGGER IF EXISTS trigger_prevent_duplicate_tarefas ON tarefas;

-- Cria trigger BEFORE INSERT
CREATE TRIGGER trigger_prevent_duplicate_tarefas
  BEFORE INSERT ON tarefas
  FOR EACH ROW
  EXECUTE FUNCTION prevent_duplicate_tarefas();