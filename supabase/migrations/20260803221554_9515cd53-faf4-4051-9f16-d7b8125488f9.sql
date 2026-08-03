CREATE OR REPLACE FUNCTION public.criar_tarefa_automatica_audiencia()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_processo RECORD;
  v_tarefa_id UUID;
  v_titulo TEXT;
  v_descricao TEXT;
  v_cabecalho TEXT;
  v_prioridade public.prioridade_tarefa;
  v_data_vencimento DATE;
  v_tarefa_existente UUID;
  v_responsaveis UUID[];
  v_principal UUID;
  v_manual BOOLEAN;
BEGIN
  IF NEW.tarefa_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

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

  SELECT p.id, p.numero, p.advogado_responsavel_id, p.cliente_id, p.coordenacao_id, c.nome AS cliente_nome
  INTO v_processo
  FROM public.processos p
  LEFT JOIN public.clientes c ON c.id = p.cliente_id
  WHERE p.id = NEW.processo_id;

  IF v_processo.id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Anti-duplicidade: mesma audiência (processo + data) já tem tarefa
  SELECT t.id INTO v_tarefa_existente
  FROM public.tarefas t
  WHERE t.processo_id = v_processo.id
    AND t.tipo_tarefa = 'audiencia'
    AND t.data_vencimento IS NOT DISTINCT FROM (
      CASE
        WHEN NEW.data_audiencia IS NULL THEN (CURRENT_DATE + INTERVAL '7 days')::DATE
        WHEN (NEW.data_audiencia::DATE - INTERVAL '2 days')::DATE < CURRENT_DATE THEN NEW.data_audiencia::DATE
        ELSE (NEW.data_audiencia::DATE - INTERVAL '2 days')::DATE
      END
    )
    AND t.status <> 'cancelado'
  LIMIT 1;
  IF v_tarefa_existente IS NOT NULL THEN
    NEW.tarefa_id := v_tarefa_existente;
    RETURN NEW;
  END IF;

  v_manual := COALESCE(NEW.origem, '') IN ('manual', 'importacao', 'astrea', 'projuris', 'pauta_excel');

  v_titulo := 'AUDIÊNCIA ' || COALESCE(NEW.tipo_audiencia, '') || ' - ' || COALESCE(v_processo.numero, NEW.processo_numero);

  v_cabecalho := CASE WHEN v_manual THEN '📅 **Audiência**' ELSE '📅 **Audiência Detectada Automaticamente**' END;

  v_descricao := v_cabecalho || E'\n\n' ||
                 '**Processo:** ' || COALESCE(v_processo.numero, NEW.processo_numero, 'N/A') || E'\n' ||
                 '**Cliente:** ' || COALESCE(v_processo.cliente_nome, 'N/A') || E'\n' ||
                 '**Tipo:** ' || COALESCE(NEW.tipo_audiencia, 'Não especificado') || E'\n' ||
                 '**Data:** ' || COALESCE(TO_CHAR(NEW.data_audiencia::DATE, 'DD/MM/YYYY'), 'A definir') || E'\n' ||
                 '**Hora:** ' || COALESCE(NEW.hora, NEW.hora_brasilia, 'A definir') || E'\n' ||
                 '**Local:** ' || COALESCE(NEW.local_audiencia, 'Não especificado') || E'\n' ||
                 '**Origem:** ' || COALESCE(NEW.origem, 'Monitoramento') || E'\n\n' ||
                 '**Contexto:**' || E'\n' || COALESCE(NEW.contexto, 'Sem detalhes');

  v_prioridade := 'alta'::public.prioridade_tarefa;

  IF NEW.data_audiencia IS NOT NULL THEN
    v_data_vencimento := (NEW.data_audiencia::DATE - INTERVAL '2 days')::DATE;
    IF v_data_vencimento < CURRENT_DATE THEN
      v_data_vencimento := NEW.data_audiencia::DATE;
    END IF;
  ELSE
    v_data_vencimento := (CURRENT_DATE + INTERVAL '7 days')::DATE;
  END IF;

  SELECT array_agg(usuario_id) INTO v_responsaveis
  FROM (
    SELECT pr.usuario_id
    FROM public.processos_responsaveis pr
    WHERE pr.processo_id = v_processo.id AND pr.ativo = true
    UNION
    SELECT p.advogado_responsavel_id
    FROM public.processos p
    WHERE p.id = v_processo.id AND p.advogado_responsavel_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM public.processos_responsaveis WHERE processo_id = p.id)
  ) s;

  v_responsaveis := COALESCE(v_responsaveis, ARRAY[]::UUID[]);
  v_principal := COALESCE(v_processo.advogado_responsavel_id, v_responsaveis[1]);

  IF v_principal IS NULL AND array_length(v_responsaveis, 1) IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.tarefas (
    titulo, descricao, tipo_tarefa, status, prioridade, data_vencimento,
    processo_id, responsavel_id, criado_por, origem, coordenacao_id
  ) VALUES (
    v_titulo, v_descricao, 'audiencia', 'pendente'::public.status_tarefa,
    v_prioridade, v_data_vencimento, v_processo.id, v_principal, v_principal,
    COALESCE(NEW.origem, 'monitoracao_360'), v_processo.coordenacao_id
  )
  RETURNING id INTO v_tarefa_id;

  NEW.tarefa_id := v_tarefa_id;

  IF v_principal IS NOT NULL THEN
    INSERT INTO public.tarefa_responsaveis (tarefa_id, usuario_id)
    VALUES (v_tarefa_id, v_principal)
    ON CONFLICT DO NOTHING;
  END IF;

  INSERT INTO public.tarefa_envolvidos (tarefa_id, usuario_id)
  SELECT v_tarefa_id, u
  FROM unnest(v_responsaveis) AS u
  WHERE u IS NOT NULL AND u IS DISTINCT FROM v_principal
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.criar_tarefa_automatica_intimacao()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_processo RECORD;
  v_tarefa_id UUID;
  v_titulo TEXT;
  v_descricao TEXT;
  v_cabecalho TEXT;
  v_prioridade public.prioridade_tarefa;
  v_data_vencimento DATE;
  v_tarefa_existente UUID;
  v_responsaveis UUID[];
  v_principal UUID;
  v_manual BOOLEAN;
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

  SELECT p.id, p.numero, p.advogado_responsavel_id, p.cliente_id, p.coordenacao_id, c.nome AS cliente_nome
  INTO v_processo
  FROM public.processos p
  LEFT JOIN public.clientes c ON c.id = p.cliente_id
  WHERE p.id = NEW.processo_id;

  IF v_processo.id IS NULL THEN
    RETURN NEW;
  END IF;

  v_manual := COALESCE(NEW.origem, '') IN ('manual', 'importacao', 'astrea', 'projuris', 'pauta_excel');

  v_titulo := COALESCE(NEW.tipo_intimacao, 'INTIMAÇÃO') || ' - ' || COALESCE(v_processo.numero, NEW.processo_numero);

  v_cabecalho := CASE WHEN v_manual THEN '📋 **Intimação**' ELSE '📋 **Intimação Detectada Automaticamente**' END;

  v_descricao := v_cabecalho || E'\n\n' ||
                 '**Processo:** ' || COALESCE(v_processo.numero, NEW.processo_numero, 'N/A') || E'\n' ||
                 '**Cliente:** ' || COALESCE(v_processo.cliente_nome, 'N/A') || E'\n' ||
                 '**Tipo:** ' || COALESCE(NEW.tipo_intimacao, 'Não especificado') || E'\n' ||
                 '**Prazo:** ' || COALESCE(NEW.prazo_dias::TEXT || ' dias', 'Não especificado') || E'\n' ||
                 '**Origem:** ' || COALESCE(NEW.origem, 'Monitoramento') || E'\n\n' ||
                 '**Contexto:**' || E'\n' || COALESCE(NEW.contexto, NEW.descricao, 'Sem detalhes');

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

  SELECT t.id INTO v_tarefa_existente
  FROM public.tarefas t
  WHERE t.processo_id = v_processo.id
    AND t.tipo_tarefa = 'intimacao'
    AND t.titulo = v_titulo
    AND t.data_vencimento IS NOT DISTINCT FROM v_data_vencimento
    AND t.status <> 'cancelado'
  LIMIT 1;
  IF v_tarefa_existente IS NOT NULL THEN
    NEW.tarefa_id := v_tarefa_existente;
    RETURN NEW;
  END IF;

  SELECT array_agg(usuario_id) INTO v_responsaveis
  FROM (
    SELECT pr.usuario_id
    FROM public.processos_responsaveis pr
    WHERE pr.processo_id = v_processo.id AND pr.ativo = true
    UNION
    SELECT p.advogado_responsavel_id
    FROM public.processos p
    WHERE p.id = v_processo.id AND p.advogado_responsavel_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM public.processos_responsaveis WHERE processo_id = p.id)
  ) s;

  v_responsaveis := COALESCE(v_responsaveis, ARRAY[]::UUID[]);
  v_principal := COALESCE(v_processo.advogado_responsavel_id, v_responsaveis[1]);

  IF v_principal IS NULL AND array_length(v_responsaveis, 1) IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.tarefas (
    titulo, descricao, tipo_tarefa, status, prioridade, data_vencimento,
    processo_id, responsavel_id, criado_por, origem, coordenacao_id
  ) VALUES (
    v_titulo, v_descricao, 'intimacao', 'pendente'::public.status_tarefa,
    v_prioridade, v_data_vencimento, v_processo.id, v_principal, v_principal,
    COALESCE(NEW.origem, 'monitoracao_360'), v_processo.coordenacao_id
  )
  RETURNING id INTO v_tarefa_id;

  NEW.tarefa_id := v_tarefa_id;

  IF v_principal IS NOT NULL THEN
    INSERT INTO public.tarefa_responsaveis (tarefa_id, usuario_id)
    VALUES (v_tarefa_id, v_principal)
    ON CONFLICT DO NOTHING;
  END IF;

  INSERT INTO public.tarefa_envolvidos (tarefa_id, usuario_id)
  SELECT v_tarefa_id, u
  FROM unnest(v_responsaveis) AS u
  WHERE u IS NOT NULL AND u IS DISTINCT FROM v_principal
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$function$;