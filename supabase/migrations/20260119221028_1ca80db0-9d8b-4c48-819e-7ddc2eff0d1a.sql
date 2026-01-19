-- 1. Adicionar campos de cobrança na tabela processos
ALTER TABLE public.processos
  ADD COLUMN IF NOT EXISTS data_encerramento_cobranca DATE,
  ADD COLUMN IF NOT EXISTS observacao_cobranca TEXT;

-- 2. Comentar os campos para documentação
COMMENT ON COLUMN public.processos.data_encerramento_cobranca IS 'Data que o advogado quer encerrar a cobrança do cliente';
COMMENT ON COLUMN public.processos.observacao_cobranca IS 'Observações sobre cobrança do processo';

-- 3. Atualizar a função get_processos_paginados para incluir filtro de situação (status já existe)
-- e adicionar suporte para instância como filtro
DROP FUNCTION IF EXISTS public.get_processos_paginados(integer,integer,text,text,text,uuid,uuid,text,boolean,boolean,boolean,boolean,boolean,timestamp with time zone,timestamp with time zone,uuid[],text);

CREATE OR REPLACE FUNCTION public.get_processos_paginados(
  _page integer DEFAULT 1,
  _page_size integer DEFAULT 50,
  _search text DEFAULT NULL,
  _area text DEFAULT NULL,
  _status text DEFAULT NULL,
  _coordenacao_id uuid DEFAULT NULL,
  _responsavel_id uuid DEFAULT NULL,
  _instancia text DEFAULT NULL,
  _com_movimento boolean DEFAULT false,
  _com_publicacao_djen boolean DEFAULT false,
  _com_audiencia boolean DEFAULT false,
  _com_intimacao boolean DEFAULT false,
  _com_tarefa boolean DEFAULT false,
  _periodo_inicio timestamp with time zone DEFAULT NULL,
  _periodo_fim timestamp with time zone DEFAULT NULL,
  _cliente_ids uuid[] DEFAULT NULL,
  _tipo_processo text DEFAULT NULL,
  _situacao text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  numero text,
  assunto text,
  area text,
  status text,
  polo_ativo text,
  polo_passivo text,
  tribunal text,
  vara text,
  comarca text,
  valor_causa numeric,
  data_distribuicao date,
  coordenacao_id uuid,
  pasta_id uuid,
  created_at timestamp with time zone,
  advogado_responsavel_id uuid,
  advogado_responsavel_nome text,
  cliente_id uuid,
  cliente_nome text,
  cliente_tipo text,
  pasta_nome text,
  total_tarefas bigint,
  total_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _offset integer;
  _count bigint;
BEGIN
  _offset := (_page - 1) * _page_size;
  
  -- Contar total de registros com os filtros aplicados
  SELECT COUNT(*) INTO _count
  FROM processos p
  LEFT JOIN processos_responsaveis pr ON pr.processo_id = p.id
  WHERE 
    -- Filtro de busca
    (_search IS NULL OR _search = '' OR 
      p.numero ILIKE '%' || _search || '%' OR
      p.assunto ILIKE '%' || _search || '%' OR
      p.polo_ativo ILIKE '%' || _search || '%' OR
      p.polo_passivo ILIKE '%' || _search || '%' OR
      p.tribunal ILIKE '%' || _search || '%' OR
      p.vara ILIKE '%' || _search || '%' OR
      p.comarca ILIKE '%' || _search || '%' OR
      p.identificador_projuris ILIKE '%' || _search || '%' OR
      p.pasta_cliente ILIKE '%' || _search || '%' OR
      p.pasta_fisica ILIKE '%' || _search || '%'
    )
    -- Filtro de área
    AND (_area IS NULL OR _area = '' OR _area = 'all' OR p.area = _area)
    -- Filtro de status - se "all", mostrar apenas ativos. Se especificado, usar o valor
    AND (
      CASE 
        WHEN _status IS NULL OR _status = '' OR _status = 'all' THEN p.status = 'ativo'
        ELSE p.status = _status
      END
    )
    -- Filtro de situação (novo, alternativo ao status)
    AND (_situacao IS NULL OR _situacao = '' OR _situacao = 'all' OR p.status = _situacao)
    -- Filtro de coordenação
    AND (_coordenacao_id IS NULL OR p.coordenacao_id = _coordenacao_id)
    -- Filtro de responsável (principal ou múltiplos)
    AND (_responsavel_id IS NULL OR p.advogado_responsavel_id = _responsavel_id OR pr.responsavel_id = _responsavel_id)
    -- Filtro de instância
    AND (_instancia IS NULL OR _instancia = '' OR _instancia = 'todos' OR 
      CASE 
        WHEN _instancia = '1' THEN p.instancia = '1º Grau' OR p.instancia = '1' OR p.instancia ILIKE '%primeiro%' OR p.instancia ILIKE '%1%grau%'
        WHEN _instancia = '2' THEN p.instancia = '2º Grau' OR p.instancia = '2' OR p.instancia ILIKE '%segundo%' OR p.instancia ILIKE '%2%grau%'
        WHEN _instancia = 'superior' THEN p.instancia ILIKE '%superior%' OR p.instancia ILIKE '%STF%' OR p.instancia ILIKE '%STJ%' OR p.instancia ILIKE '%TST%'
        ELSE true
      END
    )
    -- Filtro de período
    AND (_periodo_inicio IS NULL OR p.data_distribuicao >= _periodo_inicio::date)
    AND (_periodo_fim IS NULL OR p.data_distribuicao <= _periodo_fim::date)
    -- Filtro de cliente(s)
    AND (_cliente_ids IS NULL OR p.cliente_id = ANY(_cliente_ids))
    -- Filtro de tipo de processo
    AND (_tipo_processo IS NULL OR _tipo_processo = '' OR _tipo_processo = 'all' OR 
      CASE
        WHEN _tipo_processo = 'projuris' THEN p.identificador_projuris IS NOT NULL
        WHEN _tipo_processo = 'interno' THEN p.identificador_projuris IS NULL
        ELSE true
      END
    )
    -- Filtro de processos com movimentação
    AND (NOT _com_movimento OR EXISTS (SELECT 1 FROM movimentacoes m WHERE m.processo_id = p.id))
    -- Filtro de processos com publicação DJEN
    AND (NOT _com_publicacao_djen OR EXISTS (SELECT 1 FROM publicacoes_djen_processos pdp WHERE pdp.processo_id = p.id))
    -- Filtro de processos com audiência
    AND (NOT _com_audiencia OR EXISTS (SELECT 1 FROM audiencias_detectadas ad WHERE ad.processo_id = p.id))
    -- Filtro de processos com intimação
    AND (NOT _com_intimacao OR EXISTS (SELECT 1 FROM intimacoes_detectadas id WHERE id.processo_id = p.id))
    -- Filtro de processos com tarefa
    AND (NOT _com_tarefa OR EXISTS (SELECT 1 FROM tarefas t WHERE t.processo_id = p.id));

  -- Retornar registros paginados
  RETURN QUERY
  SELECT DISTINCT ON (p.id, p.created_at)
    p.id,
    p.numero,
    p.assunto,
    p.area,
    p.status,
    p.polo_ativo,
    p.polo_passivo,
    p.tribunal,
    p.vara,
    p.comarca,
    p.valor_causa,
    p.data_distribuicao,
    p.coordenacao_id,
    p.pasta_id,
    p.created_at,
    p.advogado_responsavel_id,
    prof.nome AS advogado_responsavel_nome,
    p.cliente_id,
    c.nome AS cliente_nome,
    c.tipo AS cliente_tipo,
    pa.nome AS pasta_nome,
    (SELECT COUNT(*) FROM tarefas t WHERE t.processo_id = p.id AND t.status IN ('pendente', 'em_andamento')) AS total_tarefas,
    _count AS total_count
  FROM processos p
  LEFT JOIN profiles prof ON p.advogado_responsavel_id = prof.id
  LEFT JOIN clientes c ON p.cliente_id = c.id
  LEFT JOIN pastas pa ON p.pasta_id = pa.id
  LEFT JOIN processos_responsaveis pr ON pr.processo_id = p.id
  WHERE 
    -- Mesmos filtros da contagem
    (_search IS NULL OR _search = '' OR 
      p.numero ILIKE '%' || _search || '%' OR
      p.assunto ILIKE '%' || _search || '%' OR
      p.polo_ativo ILIKE '%' || _search || '%' OR
      p.polo_passivo ILIKE '%' || _search || '%' OR
      p.tribunal ILIKE '%' || _search || '%' OR
      p.vara ILIKE '%' || _search || '%' OR
      p.comarca ILIKE '%' || _search || '%' OR
      p.identificador_projuris ILIKE '%' || _search || '%' OR
      p.pasta_cliente ILIKE '%' || _search || '%' OR
      p.pasta_fisica ILIKE '%' || _search || '%'
    )
    AND (_area IS NULL OR _area = '' OR _area = 'all' OR p.area = _area)
    AND (
      CASE 
        WHEN _status IS NULL OR _status = '' OR _status = 'all' THEN p.status = 'ativo'
        ELSE p.status = _status
      END
    )
    AND (_situacao IS NULL OR _situacao = '' OR _situacao = 'all' OR p.status = _situacao)
    AND (_coordenacao_id IS NULL OR p.coordenacao_id = _coordenacao_id)
    AND (_responsavel_id IS NULL OR p.advogado_responsavel_id = _responsavel_id OR pr.responsavel_id = _responsavel_id)
    AND (_instancia IS NULL OR _instancia = '' OR _instancia = 'todos' OR 
      CASE 
        WHEN _instancia = '1' THEN p.instancia = '1º Grau' OR p.instancia = '1' OR p.instancia ILIKE '%primeiro%' OR p.instancia ILIKE '%1%grau%'
        WHEN _instancia = '2' THEN p.instancia = '2º Grau' OR p.instancia = '2' OR p.instancia ILIKE '%segundo%' OR p.instancia ILIKE '%2%grau%'
        WHEN _instancia = 'superior' THEN p.instancia ILIKE '%superior%' OR p.instancia ILIKE '%STF%' OR p.instancia ILIKE '%STJ%' OR p.instancia ILIKE '%TST%'
        ELSE true
      END
    )
    AND (_periodo_inicio IS NULL OR p.data_distribuicao >= _periodo_inicio::date)
    AND (_periodo_fim IS NULL OR p.data_distribuicao <= _periodo_fim::date)
    AND (_cliente_ids IS NULL OR p.cliente_id = ANY(_cliente_ids))
    AND (_tipo_processo IS NULL OR _tipo_processo = '' OR _tipo_processo = 'all' OR 
      CASE
        WHEN _tipo_processo = 'projuris' THEN p.identificador_projuris IS NOT NULL
        WHEN _tipo_processo = 'interno' THEN p.identificador_projuris IS NULL
        ELSE true
      END
    )
    AND (NOT _com_movimento OR EXISTS (SELECT 1 FROM movimentacoes m WHERE m.processo_id = p.id))
    AND (NOT _com_publicacao_djen OR EXISTS (SELECT 1 FROM publicacoes_djen_processos pdp WHERE pdp.processo_id = p.id))
    AND (NOT _com_audiencia OR EXISTS (SELECT 1 FROM audiencias_detectadas ad WHERE ad.processo_id = p.id))
    AND (NOT _com_intimacao OR EXISTS (SELECT 1 FROM intimacoes_detectadas id WHERE id.processo_id = p.id))
    AND (NOT _com_tarefa OR EXISTS (SELECT 1 FROM tarefas t WHERE t.processo_id = p.id))
  ORDER BY p.created_at DESC, p.id
  LIMIT _page_size
  OFFSET _offset;
END;
$$;