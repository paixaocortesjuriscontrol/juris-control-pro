-- Corrigir triggers de criação automática de tarefas para Audiências/Intimações
-- Observação: tabela public.tarefas usa colunas tipo_tarefa e data_vencimento (não existe coluna tipo/data_limite)

CREATE OR REPLACE FUNCTION public.criar_tarefa_automatica_audiencia()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_processo RECORD;
  v_responsavel RECORD;
  v_tarefa_id UUID;
  v_titulo TEXT;
  v_descricao TEXT;
  v_prioridade public.prioridade_tarefa;
  v_data_vencimento DATE;
  v_tarefa_existente UUID;
  v_primeiro_responsavel BOOLEAN := true;
BEGIN
  -- Se já tem tarefa_id, não criar outra
  IF NEW.tarefa_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Verificar duplicata por movimentacao_id
  IF NEW.movimentacao_id IS NOT NULL THEN
    SELECT t.id INTO v_tarefa_existente
    FROM public.tarefas t
    JOIN public.audiencias_detectadas a ON a.tarefa_id = t.id
    WHERE a.movimentacao_id = NEW.movimentacao_id
    LIMIT 1;

    IF v_tarefa_existente IS NOT NULL THEN
      NEW.tarefa_id := v_tarefa_existente;
      RETURN NEW;
    END IF;
  END IF;

  -- Verificar duplicata por publicacao_id
  IF NEW.publicacao_id IS NOT NULL THEN
    SELECT t.id INTO v_tarefa_existente
    FROM public.tarefas t
    JOIN public.audiencias_detectadas a ON a.tarefa_id = t.id
    WHERE a.publicacao_id = NEW.publicacao_id
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

  IF v_processo.id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Definir título
  v_titulo := 'AUDIÊNCIA ' || COALESCE(NEW.tipo_audiencia, '') || ' - ' || COALESCE(v_processo.numero, NEW.processo_numero);

  -- Definir descrição
  v_descricao := '📅 **Audiência Detectada Automaticamente**' || E'\n\n' ||
                 '**Processo:** ' || COALESCE(v_processo.numero, NEW.processo_numero, 'N/A') || E'\n' ||
                 '**Cliente:** ' || COALESCE(v_processo.cliente_nome, 'N/A') || E'\n' ||
                 '**Tipo:** ' || COALESCE(NEW.tipo_audiencia, 'Não especificado') || E'\n' ||
                 '**Data:** ' || COALESCE(TO_CHAR(NEW.data_audiencia::DATE, 'DD/MM/YYYY'), 'A definir') || E'\n' ||
                 '**Hora:** ' || COALESCE(NEW.hora, NEW.hora_brasilia, 'A definir') || E'\n' ||
                 '**Local:** ' || COALESCE(NEW.local_audiencia, 'Não especificado') || E'\n' ||
                 '**Origem:** ' || COALESCE(NEW.origem, 'Monitoramento') || E'\n\n' ||
                 '**Contexto:**' || E'\n' || COALESCE(NEW.contexto, 'Sem detalhes');

  -- Audiências são sempre alta prioridade
  v_prioridade := 'alta'::public.prioridade_tarefa;

  -- Data vencimento: 2 dias antes da audiência ou hoje + 7 dias
  IF NEW.data_audiencia IS NOT NULL THEN
    v_data_vencimento := (NEW.data_audiencia::DATE - INTERVAL '2 days')::DATE;
    IF v_data_vencimento < CURRENT_DATE THEN
      v_data_vencimento := NEW.data_audiencia::DATE;
    END IF;
  ELSE
    v_data_vencimento := (CURRENT_DATE + INTERVAL '7 days')::DATE;
  END IF;

  -- Criar tarefa para cada responsável do processo
  FOR v_responsavel IN
    SELECT pr.usuario_id
    FROM public.processos_responsaveis pr
    WHERE pr.processo_id = v_processo.id AND pr.ativo = true
    UNION
    -- Fallback para advogado_responsavel_id legado
    SELECT p.advogado_responsavel_id
    FROM public.processos p
    WHERE p.id = v_processo.id AND p.advogado_responsavel_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM public.processos_responsaveis WHERE processo_id = p.id)
  LOOP
    INSERT INTO public.tarefas (
      titulo,
      descricao,
      tipo_tarefa,
      status,
      prioridade,
      data_vencimento,
      processo_id,
      responsavel_id,
      criado_por,
      origem
    ) VALUES (
      v_titulo,
      v_descricao,
      'audiencia',
      'pendente'::public.status_tarefa,
      v_prioridade,
      v_data_vencimento,
      v_processo.id,
      v_responsavel.usuario_id,
      v_responsavel.usuario_id,
      COALESCE(NEW.origem, 'monitoracao_360')
    )
    RETURNING id INTO v_tarefa_id;

    IF v_primeiro_responsavel THEN
      NEW.tarefa_id := v_tarefa_id;
      v_primeiro_responsavel := false;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.criar_tarefa_automatica_intimacao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_processo RECORD;
  v_responsavel RECORD;
  v_tarefa_id UUID;
  v_titulo TEXT;
  v_descricao TEXT;
  v_prioridade public.prioridade_tarefa;
  v_data_vencimento DATE;
  v_tarefa_existente UUID;
  v_primeiro_responsavel BOOLEAN := true;
BEGIN
  IF NEW.tarefa_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

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

  SELECT p.id, p.numero, p.advogado_responsavel_id, p.cliente_id, c.nome as cliente_nome
  INTO v_processo
  FROM public.processos p
  LEFT JOIN public.clientes c ON c.id = p.cliente_id
  WHERE p.id = NEW.processo_id;

  IF v_processo.id IS NULL THEN
    RETURN NEW;
  END IF;

  v_titulo := COALESCE(NEW.tipo_intimacao, 'INTIMAÇÃO') || ' - ' || COALESCE(v_processo.numero, NEW.processo_numero);

  v_descricao := '📋 **Intimação Detectada Automaticamente**' || E'\n\n' ||
                 '**Processo:** ' || COALESCE(v_processo.numero, NEW.processo_numero, 'N/A') || E'\n' ||
                 '**Cliente:** ' || COALESCE(v_processo.cliente_nome, 'N/A') || E'\n' ||
                 '**Tipo:** ' || COALESCE(NEW.tipo_intimacao, 'Não especificado') || E'\n' ||
                 '**Prazo:** ' || COALESCE(NEW.prazo_dias::TEXT || ' dias', 'Não especificado') || E'\n' ||
                 '**Origem:** ' || COALESCE(NEW.origem, 'Monitoramento') || E'\n\n' ||
                 '**Contexto:**' || E'\n' || COALESCE(NEW.contexto, NEW.descricao, 'Sem detalhes');

  -- Prioridade baseada no prazo (mapeada para enum existente)
  IF NEW.prazo_dias IS NOT NULL THEN
    IF NEW.prazo_dias <= 3 THEN
      v_prioridade := 'urgente'::public.prioridade_tarefa;
    ELSIF NEW.prazo_dias <= 5 THEN
      v_prioridade := 'alta'::public.prioridade_tarefa;
    ELSIF NEW.prazo_dias <= 10 THEN
      v_prioridade := 'media'::public.prioridade_tarefa;
    ELSE
      v_prioridade := 'baixa'::public.prioridade_tarefa;
    END IF;
  ELSE
    v_prioridade := COALESCE(NEW.prioridade, 'alta')::public.prioridade_tarefa;
  END IF;

  v_data_vencimento := COALESCE(
    NEW.data_limite::DATE,
    CASE
      WHEN NEW.prazo_dias IS NOT NULL THEN (CURRENT_DATE + (NEW.prazo_dias || ' days')::INTERVAL)::DATE
      ELSE (CURRENT_DATE + INTERVAL '5 days')::DATE
    END
  );

  FOR v_responsavel IN
    SELECT pr.usuario_id
    FROM public.processos_responsaveis pr
    WHERE pr.processo_id = v_processo.id AND pr.ativo = true
    UNION
    SELECT p.advogado_responsavel_id
    FROM public.processos p
    WHERE p.id = v_processo.id AND p.advogado_responsavel_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM public.processos_responsaveis WHERE processo_id = p.id)
  LOOP
    INSERT INTO public.tarefas (
      titulo,
      descricao,
      tipo_tarefa,
      status,
      prioridade,
      data_vencimento,
      processo_id,
      responsavel_id,
      criado_por,
      origem
    ) VALUES (
      v_titulo,
      v_descricao,
      'intimacao',
      'pendente'::public.status_tarefa,
      v_prioridade,
      v_data_vencimento,
      v_processo.id,
      v_responsavel.usuario_id,
      v_responsavel.usuario_id,
      COALESCE(NEW.origem, 'monitoracao_360')
    )
    RETURNING id INTO v_tarefa_id;

    IF v_primeiro_responsavel THEN
      NEW.tarefa_id := v_tarefa_id;
      v_primeiro_responsavel := false;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;