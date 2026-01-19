-- Dropar TODAS as versões existentes da função
DROP FUNCTION IF EXISTS public.get_processos_paginados(integer, integer, text, text, text, text, text, text, boolean, boolean, boolean, boolean, boolean, timestamp with time zone, timestamp with time zone, uuid[], text);
DROP FUNCTION IF EXISTS public.get_processos_paginados(integer, integer, text, text, text, uuid, uuid, text, boolean, boolean, boolean, boolean, boolean, timestamp with time zone, timestamp with time zone, uuid[], text, text);
DROP FUNCTION IF EXISTS public.get_processos_paginados(integer, integer, text, text, status_processo, text, text, text, boolean, boolean, boolean, boolean, boolean, timestamp with time zone, timestamp with time zone, uuid[], text);

-- Recriar a função com assinatura limpa
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
  _tipo_processo text DEFAULT NULL
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
  advogado_responsavel jsonb,
  cliente jsonb,
  tipo_processo text,
  total_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_offset integer;
  v_total_count bigint;
BEGIN
  v_offset := (_page - 1) * _page_size;

  -- Contar total separadamente para melhor performance
  SELECT COUNT(*)
  INTO v_total_count
  FROM processos p
  WHERE
    (_search IS NULL OR (
      p.numero ILIKE '%' || _search || '%' OR
      p.assunto ILIKE '%' || _search || '%' OR
      p.polo_ativo ILIKE '%' || _search || '%' OR
      p.polo_passivo ILIKE '%' || _search || '%'
    ))
    AND (_area IS NULL OR p.area = _area)
    AND (_status IS NULL OR p.status::text = _status)
    AND (_coordenacao_id IS NULL OR p.coordenacao_id = _coordenacao_id)
    AND (_responsavel_id IS NULL OR p.advogado_responsavel_id = _responsavel_id)
    AND (_tipo_processo IS NULL OR p.tipo_processo = _tipo_processo)
    AND (_instancia IS NULL OR (
      CASE
        WHEN LOWER(_instancia) IN ('1', '1º grau', '1o grau', 'primeiro grau', '1_grau') THEN
          LOWER(COALESCE(p.instancia, '')) LIKE '%1%' OR LOWER(COALESCE(p.instancia, '')) LIKE '%primeiro%'
        WHEN LOWER(_instancia) IN ('2', '2º grau', '2o grau', 'segundo grau', '2_grau') THEN
          LOWER(COALESCE(p.instancia, '')) LIKE '%2%' OR LOWER(COALESCE(p.instancia, '')) LIKE '%segundo%'
        WHEN LOWER(_instancia) IN ('superior', 'tribunais superiores', 'stf', 'stj', 'tst', 'superiores') THEN
          LOWER(COALESCE(p.instancia, '')) LIKE '%superior%' OR 
          LOWER(COALESCE(p.instancia, '')) LIKE '%stf%' OR 
          LOWER(COALESCE(p.instancia, '')) LIKE '%stj%' OR 
          LOWER(COALESCE(p.instancia, '')) LIKE '%tst%'
        ELSE true
      END
    ))
    AND (NOT _com_movimento OR EXISTS (
      SELECT 1 FROM movimentacoes m
      WHERE m.processo_id = p.id
      AND (_periodo_inicio IS NULL OR m.data_movimentacao >= _periodo_inicio::date)
      AND (_periodo_fim IS NULL OR m.data_movimentacao <= _periodo_fim::date)
    ))
    AND (NOT _com_publicacao_djen OR EXISTS (
      SELECT 1 FROM publicacoes_djen pd
      WHERE pd.processo_id = p.id
      AND (_periodo_inicio IS NULL OR pd.data_disponibilizacao >= _periodo_inicio::date)
      AND (_periodo_fim IS NULL OR pd.data_disponibilizacao <= _periodo_fim::date)
    ))
    AND (NOT _com_audiencia OR EXISTS (
      SELECT 1 FROM audiencias_detectadas ad
      WHERE ad.processo_id = p.id
      AND (_periodo_inicio IS NULL OR ad.data_audiencia >= _periodo_inicio::date)
      AND (_periodo_fim IS NULL OR ad.data_audiencia <= _periodo_fim::date)
    ))
    AND (NOT _com_intimacao OR EXISTS (
      SELECT 1 FROM intimacoes_detectadas idet
      WHERE idet.processo_id = p.id
      AND (_periodo_inicio IS NULL OR idet.data_intimacao >= _periodo_inicio::date)
      AND (_periodo_fim IS NULL OR idet.data_intimacao <= _periodo_fim::date)
    ))
    AND (NOT _com_tarefa OR EXISTS (
      SELECT 1 FROM tarefas t
      WHERE t.processo_id = p.id
      AND (_periodo_inicio IS NULL OR t.data_vencimento >= _periodo_inicio::date)
      AND (_periodo_fim IS NULL OR t.data_vencimento <= _periodo_fim::date)
    ))
    AND (_cliente_ids IS NULL OR p.cliente_id = ANY(_cliente_ids));

  RETURN QUERY
  SELECT
    p.id,
    p.numero,
    p.assunto,
    p.area,
    p.status::text,
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
    CASE WHEN pr.id IS NOT NULL THEN jsonb_build_object('id', pr.id, 'nome', pr.nome) ELSE NULL END,
    CASE WHEN c.id IS NOT NULL THEN jsonb_build_object('id', c.id, 'nome', c.nome) ELSE NULL END,
    p.tipo_processo,
    v_total_count
  FROM processos p
  LEFT JOIN profiles pr ON p.advogado_responsavel_id = pr.id
  LEFT JOIN clientes c ON p.cliente_id = c.id
  WHERE
    (_search IS NULL OR (
      p.numero ILIKE '%' || _search || '%' OR
      p.assunto ILIKE '%' || _search || '%' OR
      p.polo_ativo ILIKE '%' || _search || '%' OR
      p.polo_passivo ILIKE '%' || _search || '%'
    ))
    AND (_area IS NULL OR p.area = _area)
    AND (_status IS NULL OR p.status::text = _status)
    AND (_coordenacao_id IS NULL OR p.coordenacao_id = _coordenacao_id)
    AND (_responsavel_id IS NULL OR p.advogado_responsavel_id = _responsavel_id)
    AND (_tipo_processo IS NULL OR p.tipo_processo = _tipo_processo)
    AND (_instancia IS NULL OR (
      CASE
        WHEN LOWER(_instancia) IN ('1', '1º grau', '1o grau', 'primeiro grau', '1_grau') THEN
          LOWER(COALESCE(p.instancia, '')) LIKE '%1%' OR LOWER(COALESCE(p.instancia, '')) LIKE '%primeiro%'
        WHEN LOWER(_instancia) IN ('2', '2º grau', '2o grau', 'segundo grau', '2_grau') THEN
          LOWER(COALESCE(p.instancia, '')) LIKE '%2%' OR LOWER(COALESCE(p.instancia, '')) LIKE '%segundo%'
        WHEN LOWER(_instancia) IN ('superior', 'tribunais superiores', 'stf', 'stj', 'tst', 'superiores') THEN
          LOWER(COALESCE(p.instancia, '')) LIKE '%superior%' OR 
          LOWER(COALESCE(p.instancia, '')) LIKE '%stf%' OR 
          LOWER(COALESCE(p.instancia, '')) LIKE '%stj%' OR 
          LOWER(COALESCE(p.instancia, '')) LIKE '%tst%'
        ELSE true
      END
    ))
    AND (NOT _com_movimento OR EXISTS (
      SELECT 1 FROM movimentacoes m
      WHERE m.processo_id = p.id
      AND (_periodo_inicio IS NULL OR m.data_movimentacao >= _periodo_inicio::date)
      AND (_periodo_fim IS NULL OR m.data_movimentacao <= _periodo_fim::date)
    ))
    AND (NOT _com_publicacao_djen OR EXISTS (
      SELECT 1 FROM publicacoes_djen pd
      WHERE pd.processo_id = p.id
      AND (_periodo_inicio IS NULL OR pd.data_disponibilizacao >= _periodo_inicio::date)
      AND (_periodo_fim IS NULL OR pd.data_disponibilizacao <= _periodo_fim::date)
    ))
    AND (NOT _com_audiencia OR EXISTS (
      SELECT 1 FROM audiencias_detectadas ad
      WHERE ad.processo_id = p.id
      AND (_periodo_inicio IS NULL OR ad.data_audiencia >= _periodo_inicio::date)
      AND (_periodo_fim IS NULL OR ad.data_audiencia <= _periodo_fim::date)
    ))
    AND (NOT _com_intimacao OR EXISTS (
      SELECT 1 FROM intimacoes_detectadas idet
      WHERE idet.processo_id = p.id
      AND (_periodo_inicio IS NULL OR idet.data_intimacao >= _periodo_inicio::date)
      AND (_periodo_fim IS NULL OR idet.data_intimacao <= _periodo_fim::date)
    ))
    AND (NOT _com_tarefa OR EXISTS (
      SELECT 1 FROM tarefas t
      WHERE t.processo_id = p.id
      AND (_periodo_inicio IS NULL OR t.data_vencimento >= _periodo_inicio::date)
      AND (_periodo_fim IS NULL OR t.data_vencimento <= _periodo_fim::date)
    ))
    AND (_cliente_ids IS NULL OR p.cliente_id = ANY(_cliente_ids))
  ORDER BY p.created_at DESC
  LIMIT _page_size
  OFFSET v_offset;
END;
$$;

-- Conceder permissões
GRANT EXECUTE ON FUNCTION public.get_processos_paginados(integer, integer, text, text, text, uuid, uuid, text, boolean, boolean, boolean, boolean, boolean, timestamp with time zone, timestamp with time zone, uuid[], text) TO anon, authenticated, service_role;