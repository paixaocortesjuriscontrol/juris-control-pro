-- =============================================
-- MÚLTIPLOS RESPONSÁVEIS POR PROCESSO
-- =============================================

-- 1. Criar tabela de vínculo processo-advogados
CREATE TABLE public.processos_responsaveis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  processo_id UUID NOT NULL REFERENCES public.processos(id) ON DELETE CASCADE,
  usuario_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  coordenacao_id UUID REFERENCES public.coordenacoes(id) ON DELETE SET NULL,
  papel TEXT DEFAULT 'responsavel', -- responsavel, apoio, supervisor
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(processo_id, usuario_id)
);

-- 2. Índices para performance
CREATE INDEX idx_processos_responsaveis_processo ON public.processos_responsaveis(processo_id);
CREATE INDEX idx_processos_responsaveis_usuario ON public.processos_responsaveis(usuario_id);
CREATE INDEX idx_processos_responsaveis_coordenacao ON public.processos_responsaveis(coordenacao_id);

-- 3. RLS
ALTER TABLE public.processos_responsaveis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários autenticados podem ver responsáveis"
ON public.processos_responsaveis FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins e coordenadores podem gerenciar responsáveis"
ON public.processos_responsaveis FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- 4. Migrar dados existentes para a nova tabela
INSERT INTO public.processos_responsaveis (processo_id, usuario_id, coordenacao_id, papel)
SELECT id, advogado_responsavel_id, coordenacao_id, 'responsavel'
FROM public.processos
WHERE advogado_responsavel_id IS NOT NULL
ON CONFLICT (processo_id, usuario_id) DO NOTHING;

-- 5. Atualizar função de criação automática de tarefas para intimações
CREATE OR REPLACE FUNCTION public.criar_tarefa_automatica_intimacao()
RETURNS TRIGGER AS $$
DECLARE
  v_processo RECORD;
  v_responsavel RECORD;
  v_tarefa_id UUID;
  v_titulo TEXT;
  v_descricao TEXT;
  v_prioridade TEXT;
  v_data_limite TIMESTAMPTZ;
  v_tarefa_existente UUID;
  v_primeiro_responsavel BOOLEAN := true;
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
  
  IF v_processo.id IS NULL THEN
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
  
  -- Criar tarefa para cada responsável do processo (nova tabela)
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
      v_responsavel.usuario_id,
      v_responsavel.usuario_id
    )
    RETURNING id INTO v_tarefa_id;
    
    -- Vincular apenas a primeira tarefa à intimação (referência principal)
    IF v_primeiro_responsavel THEN
      NEW.tarefa_id := v_tarefa_id;
      v_primeiro_responsavel := false;
    END IF;
  END LOOP;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 6. Atualizar função de criação automática de tarefas para audiências
CREATE OR REPLACE FUNCTION public.criar_tarefa_automatica_audiencia()
RETURNS TRIGGER AS $$
DECLARE
  v_processo RECORD;
  v_responsavel RECORD;
  v_tarefa_id UUID;
  v_titulo TEXT;
  v_descricao TEXT;
  v_prioridade TEXT;
  v_data_limite TIMESTAMPTZ;
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
  v_titulo := 'AUDIÊNCIA ' || COALESCE(NEW.tipo_audiencia, '') || ' - ' || 
              COALESCE(v_processo.numero, NEW.processo_numero);
  
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
  v_prioridade := 'alta';
  
  -- Data limite: 2 dias antes da audiência ou a data da audiência se já passou
  IF NEW.data_audiencia IS NOT NULL THEN
    v_data_limite := (NEW.data_audiencia::DATE - INTERVAL '2 days')::TIMESTAMPTZ;
    IF v_data_limite < NOW() THEN
      v_data_limite := NEW.data_audiencia::TIMESTAMPTZ;
    END IF;
  ELSE
    v_data_limite := NOW() + INTERVAL '7 days';
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
      'audiencia',
      'pendente',
      v_prioridade,
      v_data_limite,
      v_processo.id,
      v_responsavel.usuario_id,
      v_responsavel.usuario_id
    )
    RETURNING id INTO v_tarefa_id;
    
    -- Vincular apenas a primeira tarefa à audiência
    IF v_primeiro_responsavel THEN
      NEW.tarefa_id := v_tarefa_id;
      v_primeiro_responsavel := false;
    END IF;
  END LOOP;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;