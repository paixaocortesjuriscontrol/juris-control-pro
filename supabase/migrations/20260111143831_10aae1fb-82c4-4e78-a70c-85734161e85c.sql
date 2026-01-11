-- =============================================
-- ADICIONAR CAMPOS PARA VINCULAR TAREFAS AUTOMÁTICAS
-- =============================================

-- Adicionar tarefa_id nas intimacoes_detectadas
ALTER TABLE public.intimacoes_detectadas
ADD COLUMN IF NOT EXISTS tarefa_id UUID REFERENCES public.tarefas(id) ON DELETE SET NULL;

-- Adicionar tarefa_id nas audiencias_detectadas
ALTER TABLE public.audiencias_detectadas
ADD COLUMN IF NOT EXISTS tarefa_id UUID REFERENCES public.tarefas(id) ON DELETE SET NULL;

-- Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_intimacoes_detectadas_tarefa_id ON public.intimacoes_detectadas(tarefa_id);
CREATE INDEX IF NOT EXISTS idx_audiencias_detectadas_tarefa_id ON public.audiencias_detectadas(tarefa_id);

-- =============================================
-- FUNÇÃO PARA CRIAR TAREFA AUTOMATICAMENTE
-- =============================================

CREATE OR REPLACE FUNCTION public.criar_tarefa_automatica_intimacao()
RETURNS TRIGGER AS $$
DECLARE
  v_responsavel_id UUID;
  v_titulo TEXT;
  v_descricao TEXT;
  v_data_vencimento DATE;
  v_prioridade TEXT;
  v_tarefa_id UUID;
BEGIN
  -- Só criar se não existe tarefa vinculada e tem processo_id
  IF NEW.tarefa_id IS NOT NULL OR NEW.processo_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Buscar responsável do processo
  SELECT advogado_responsavel_id INTO v_responsavel_id
  FROM public.processos
  WHERE id = NEW.processo_id;

  -- Se não tem responsável, não cria tarefa
  IF v_responsavel_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Definir título baseado no tipo
  v_titulo := COALESCE(
    'INTIMAÇÃO: ' || COALESCE(NEW.tipo_intimacao, 'Verificar'),
    'Intimação Detectada - Verificar Providências'
  );

  -- Definir descrição com contexto
  v_descricao := 'Intimação detectada automaticamente pelo monitoramento DJEN.' || E'\n\n';
  v_descricao := v_descricao || 'Processo: ' || COALESCE(NEW.processo_numero, 'N/A') || E'\n';
  v_descricao := v_descricao || 'Tipo: ' || COALESCE(NEW.tipo_intimacao, 'N/A') || E'\n';
  v_descricao := v_descricao || 'Prazo: ' || COALESCE(NEW.prazo_dias::TEXT || ' dias', 'A verificar') || E'\n';
  IF NEW.data_disponibilizacao IS NOT NULL THEN
    v_descricao := v_descricao || 'Disponibilização: ' || TO_CHAR(NEW.data_disponibilizacao, 'DD/MM/YYYY') || E'\n';
  END IF;
  IF NEW.contexto IS NOT NULL THEN
    v_descricao := v_descricao || E'\nContexto:\n' || NEW.contexto;
  END IF;

  -- Definir data de vencimento
  IF NEW.data_limite IS NOT NULL THEN
    v_data_vencimento := NEW.data_limite::DATE;
  ELSIF NEW.prazo_dias IS NOT NULL AND NEW.data_intimacao IS NOT NULL THEN
    v_data_vencimento := (NEW.data_intimacao + (NEW.prazo_dias || ' days')::INTERVAL)::DATE;
  ELSE
    -- Default: 5 dias úteis a partir de hoje
    v_data_vencimento := (CURRENT_DATE + INTERVAL '7 days')::DATE;
  END IF;

  -- Definir prioridade baseada no prazo
  IF v_data_vencimento <= CURRENT_DATE + INTERVAL '2 days' THEN
    v_prioridade := 'urgente';
  ELSIF v_data_vencimento <= CURRENT_DATE + INTERVAL '5 days' THEN
    v_prioridade := 'alta';
  ELSIF v_data_vencimento <= CURRENT_DATE + INTERVAL '10 days' THEN
    v_prioridade := 'media';
  ELSE
    v_prioridade := 'baixa';
  END IF;

  -- Criar a tarefa
  INSERT INTO public.tarefas (
    processo_id,
    titulo,
    descricao,
    data_vencimento,
    prioridade,
    status,
    responsavel_id,
    tipo_tarefa,
    criado_por_nome
  ) VALUES (
    NEW.processo_id,
    v_titulo,
    v_descricao,
    v_data_vencimento,
    v_prioridade::prioridade_tarefa,
    'pendente',
    v_responsavel_id,
    CASE 
      WHEN LOWER(COALESCE(NEW.tipo_intimacao, '')) LIKE '%contestação%' THEN 'DEFESA'
      WHEN LOWER(COALESCE(NEW.tipo_intimacao, '')) LIKE '%recurso%' THEN 'RECURSO'
      WHEN LOWER(COALESCE(NEW.tipo_intimacao, '')) LIKE '%contrarrazões%' THEN 'CONTRARRAZÕES'
      WHEN LOWER(COALESCE(NEW.tipo_intimacao, '')) LIKE '%manifestação%' THEN 'PETIÇÃO'
      ELSE 'VERIFICAÇÃO'
    END,
    'Sistema (Monitoramento DJEN)'
  )
  RETURNING id INTO v_tarefa_id;

  -- Atualizar a intimação com o id da tarefa
  NEW.tarefa_id := v_tarefa_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- =============================================
-- FUNÇÃO PARA CRIAR TAREFA AUTOMATICAMENTE - AUDIÊNCIA
-- =============================================

CREATE OR REPLACE FUNCTION public.criar_tarefa_automatica_audiencia()
RETURNS TRIGGER AS $$
DECLARE
  v_responsavel_id UUID;
  v_titulo TEXT;
  v_descricao TEXT;
  v_data_vencimento DATE;
  v_prioridade TEXT;
  v_tarefa_id UUID;
BEGIN
  -- Só criar se não existe tarefa vinculada e tem processo_id
  IF NEW.tarefa_id IS NOT NULL OR NEW.processo_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Buscar responsável do processo
  SELECT advogado_responsavel_id INTO v_responsavel_id
  FROM public.processos
  WHERE id = NEW.processo_id;

  -- Se não tem responsável, não cria tarefa
  IF v_responsavel_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Definir título
  v_titulo := 'AUDIÊNCIA: ' || COALESCE(NEW.tipo_audiencia, 'Verificar');

  -- Definir descrição com contexto
  v_descricao := 'Audiência detectada automaticamente pelo monitoramento DJEN.' || E'\n\n';
  v_descricao := v_descricao || 'Processo: ' || COALESCE(NEW.processo_numero, 'N/A') || E'\n';
  v_descricao := v_descricao || 'Tipo: ' || COALESCE(NEW.tipo_audiencia, 'N/A') || E'\n';
  IF NEW.data_audiencia IS NOT NULL THEN
    v_descricao := v_descricao || 'Data: ' || TO_CHAR(NEW.data_audiencia, 'DD/MM/YYYY') || E'\n';
  END IF;
  IF NEW.hora IS NOT NULL THEN
    v_descricao := v_descricao || 'Hora: ' || NEW.hora || E'\n';
  END IF;
  IF NEW.local_audiencia IS NOT NULL THEN
    v_descricao := v_descricao || 'Local: ' || NEW.local_audiencia || E'\n';
  END IF;
  IF NEW.comarca IS NOT NULL THEN
    v_descricao := v_descricao || 'Comarca: ' || NEW.comarca || E'\n';
  END IF;
  IF NEW.contexto IS NOT NULL THEN
    v_descricao := v_descricao || E'\nContexto:\n' || NEW.contexto;
  END IF;

  -- Definir data de vencimento (dia da audiência ou 5 dias antes para preparação)
  IF NEW.data_audiencia IS NOT NULL THEN
    -- Prazo é 2 dias antes da audiência para preparação
    v_data_vencimento := (NEW.data_audiencia - INTERVAL '2 days')::DATE;
    -- Se já passou, usar a data da audiência
    IF v_data_vencimento < CURRENT_DATE THEN
      v_data_vencimento := NEW.data_audiencia::DATE;
    END IF;
  ELSE
    v_data_vencimento := (CURRENT_DATE + INTERVAL '7 days')::DATE;
  END IF;

  -- Audiências sempre são urgentes ou alta prioridade
  IF v_data_vencimento <= CURRENT_DATE + INTERVAL '3 days' THEN
    v_prioridade := 'urgente';
  ELSE
    v_prioridade := 'alta';
  END IF;

  -- Criar a tarefa
  INSERT INTO public.tarefas (
    processo_id,
    titulo,
    descricao,
    data_vencimento,
    prioridade,
    status,
    responsavel_id,
    tipo_tarefa,
    criado_por_nome
  ) VALUES (
    NEW.processo_id,
    v_titulo,
    v_descricao,
    v_data_vencimento,
    v_prioridade::prioridade_tarefa,
    'pendente',
    v_responsavel_id,
    'AUDIÊNCIA',
    'Sistema (Monitoramento DJEN)'
  )
  RETURNING id INTO v_tarefa_id;

  -- Atualizar a audiência com o id da tarefa
  NEW.tarefa_id := v_tarefa_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- =============================================
-- CRIAR TRIGGERS
-- =============================================

-- Remover triggers existentes se houver
DROP TRIGGER IF EXISTS trigger_criar_tarefa_intimacao ON public.intimacoes_detectadas;
DROP TRIGGER IF EXISTS trigger_criar_tarefa_audiencia ON public.audiencias_detectadas;

-- Criar trigger para intimações
CREATE TRIGGER trigger_criar_tarefa_intimacao
  BEFORE INSERT ON public.intimacoes_detectadas
  FOR EACH ROW
  EXECUTE FUNCTION public.criar_tarefa_automatica_intimacao();

-- Criar trigger para audiências
CREATE TRIGGER trigger_criar_tarefa_audiencia
  BEFORE INSERT ON public.audiencias_detectadas
  FOR EACH ROW
  EXECUTE FUNCTION public.criar_tarefa_automatica_audiencia();