-- =============================================
-- PROTEÇÃO CONTRA DUPLICIDADE DE INTIMAÇÕES E TAREFAS
-- =============================================

-- 1. Índice único parcial para evitar intimações duplicadas pela mesma movimentação
CREATE UNIQUE INDEX IF NOT EXISTS idx_intimacoes_movimentacao_unica 
ON public.intimacoes_detectadas (movimentacao_id) 
WHERE movimentacao_id IS NOT NULL;

-- 2. Índice único para hash_dedup (já usado pelo DJEN)
CREATE UNIQUE INDEX IF NOT EXISTS idx_intimacoes_hash_dedup_unica 
ON public.intimacoes_detectadas (hash_dedup) 
WHERE hash_dedup IS NOT NULL;

-- 3. Atualizar a função de criação automática de tarefas para ser idempotente
CREATE OR REPLACE FUNCTION public.criar_tarefa_automatica_intimacao()
RETURNS TRIGGER AS $$
DECLARE
  v_processo RECORD;
  v_tarefa_id UUID;
  v_titulo TEXT;
  v_descricao TEXT;
  v_prioridade TEXT;
  v_data_limite TIMESTAMPTZ;
  v_tarefa_existente UUID;
BEGIN
  -- Se já tem tarefa_id, não criar outra
  IF NEW.tarefa_id IS NOT NULL THEN
    RETURN NEW;
  END IF;
  
  -- Verificar se já existe tarefa para esta movimentação (evita duplicatas)
  IF NEW.movimentacao_id IS NOT NULL THEN
    SELECT t.id INTO v_tarefa_existente
    FROM public.tarefas t
    JOIN public.intimacoes_detectadas i ON i.tarefa_id = t.id
    WHERE i.movimentacao_id = NEW.movimentacao_id
    LIMIT 1;
    
    IF v_tarefa_existente IS NOT NULL THEN
      NEW.tarefa_id := v_tarefa_existente;
      RETURN NEW;
    END IF;
  END IF;
  
  -- Verificar se já existe tarefa para este hash_dedup (DJEN)
  IF NEW.hash_dedup IS NOT NULL THEN
    SELECT t.id INTO v_tarefa_existente
    FROM public.tarefas t
    JOIN public.intimacoes_detectadas i ON i.tarefa_id = t.id
    WHERE i.hash_dedup = NEW.hash_dedup
    LIMIT 1;
    
    IF v_tarefa_existente IS NOT NULL THEN
      NEW.tarefa_id := v_tarefa_existente;
      RETURN NEW;
    END IF;
  END IF;

  -- Buscar dados do processo
  SELECT p.id, p.numero, p.advogado_responsavel_id, p.cliente_id, c.nome as cliente_nome
  INTO v_processo
  FROM public.processos p
  LEFT JOIN public.clientes c ON c.id = p.cliente_id
  WHERE p.id = NEW.processo_id;
  
  -- Só criar tarefa se tiver processo com advogado responsável
  IF v_processo.id IS NULL OR v_processo.advogado_responsavel_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Definir título
  v_titulo := COALESCE(NEW.tipo_intimacao, 'INTIMAÇÃO') || ' - ' || 
              COALESCE(v_processo.numero, NEW.processo_numero);
  
  -- Definir descrição
  v_descricao := '📋 **Intimação Detectada Automaticamente**' || E'\n\n' ||
                 '**Processo:** ' || COALESCE(v_processo.numero, NEW.processo_numero, 'N/A') || E'\n' ||
                 '**Cliente:** ' || COALESCE(v_processo.cliente_nome, 'N/A') || E'\n' ||
                 '**Tipo:** ' || COALESCE(NEW.tipo_intimacao, 'Não especificado') || E'\n' ||
                 '**Prazo:** ' || COALESCE(NEW.prazo_dias::TEXT || ' dias', 'Não especificado') || E'\n' ||
                 '**Origem:** ' || COALESCE(NEW.origem, 'Monitoramento') || E'\n\n' ||
                 '**Contexto:**' || E'\n' || COALESCE(NEW.contexto, NEW.descricao, 'Sem detalhes');
  
  -- Definir prioridade baseada no prazo
  IF NEW.prazo_dias IS NOT NULL THEN
    IF NEW.prazo_dias <= 3 THEN
      v_prioridade := 'urgente';
    ELSIF NEW.prazo_dias <= 5 THEN
      v_prioridade := 'alta';
    ELSIF NEW.prazo_dias <= 10 THEN
      v_prioridade := 'media';
    ELSE
      v_prioridade := 'normal';
    END IF;
  ELSE
    v_prioridade := COALESCE(NEW.prioridade, 'alta');
  END IF;
  
  -- Definir data limite
  v_data_limite := COALESCE(
    NEW.data_limite::TIMESTAMPTZ,
    CASE WHEN NEW.prazo_dias IS NOT NULL 
         THEN (NOW() + (NEW.prazo_dias || ' days')::INTERVAL)
         ELSE (NOW() + INTERVAL '5 days')
    END
  );
  
  -- Criar a tarefa
  INSERT INTO public.tarefas (
    titulo,
    descricao,
    tipo,
    status,
    prioridade,
    data_limite,
    processo_id,
    responsavel_id,
    criado_por
  ) VALUES (
    v_titulo,
    v_descricao,
    'verificacao',
    'pendente',
    v_prioridade,
    v_data_limite,
    v_processo.id,
    v_processo.advogado_responsavel_id,
    v_processo.advogado_responsavel_id
  )
  RETURNING id INTO v_tarefa_id;
  
  -- Vincular a tarefa à intimação
  NEW.tarefa_id := v_tarefa_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;