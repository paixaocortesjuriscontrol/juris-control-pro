-- Corrigir filtro de DJEN: tabela publicacoes_djen não possui processo_id; usar publicacoes_djen_processos.
-- Também definir search_path para evitar Function Search Path Mutable.

DROP FUNCTION IF EXISTS public.get_processos_paginados(integer, integer, text, text, text, uuid, uuid, text, boolean, boolean, boolean, boolean, boolean, timestamp with time zone, timestamp with time zone, uuid[], text);

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
RETURNS TABLE(
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
SET search_path = public
AS $$
DECLARE
  v_offset integer;
  v_total_count bigint;
BEGIN
  v_offset := (_page - 1) * _page_size;

  -- Total (separado para performance)
  SELECT COUNT(DISTINCT p.id) INTO v_total_count
  FROM processos p
  LEFT JOIN clientes c ON p.cliente_id = c.id
  WHERE
    (_search IS NULL OR _search = '' OR 
      p.numero ILIKE '%' || _search || '%' OR 
      p.assunto ILIKE '%' || _search || '%' OR
      p.polo_ativo ILIKE '%' || _search || '%' OR
      p.polo_passivo ILIKE '%' || _search || '%' OR
      c.nome ILIKE '%' || _search || '%')
    AND (_area IS NULL OR p.area = _area)
    AND (_status IS NULL OR p.status::text = _status)
    AND (_coordenacao_id IS NULL OR p.coordenacao_id = _coordenacao_id)
    AND (_responsavel_id IS NULL OR p.advogado_responsavel_id = _responsavel_id)
    AND (_tipo_processo IS NULL OR p.tipo_processo = _tipo_processo)
    AND (_instancia IS NULL OR 
      (CASE 
        WHEN _instancia IN ('1', '1º Grau', '1o Grau', 'primeiro') THEN 
          p.instancia ILIKE '%1%' OR p.instancia ILIKE '%primeiro%'
        WHEN _instancia IN ('2', '2º Grau', '2o Grau', 'segundo') THEN 
          p.instancia ILIKE '%2%' OR p.instancia ILIKE '%segundo%'
        WHEN _instancia IN ('superior', 'superiores', 'STF', 'STJ', 'TST') THEN 
          p.instancia ILIKE '%super%' OR p.instancia ILIKE '%STF%' OR p.instancia ILIKE '%STJ%' OR p.instancia ILIKE '%TST%'
        ELSE p.instancia ILIKE '%' || _instancia || '%'
      END))
    AND (_cliente_ids IS NULL OR p.cliente_id = ANY(_cliente_ids))
    AND (NOT _com_movimento OR EXISTS (
      SELECT 1 FROM movimentacoes m 
      WHERE m.processo_id = p.id 
        AND (_periodo_inicio IS NULL OR m.data_movimentacao >= _periodo_inicio::date)
        AND (_periodo_fim IS NULL OR m.data_movimentacao <= _periodo_fim::date)
    ))
    AND (NOT _com_publicacao_djen OR EXISTS (
      SELECT 1 FROM publicacoes_djen_processos pdp
      WHERE pdp.processo_id = p.id
        AND (_periodo_inicio IS NULL OR pdp.data_disponibilizacao >= _periodo_inicio)
        AND (_periodo_fim IS NULL OR pdp.data_disponibilizacao <= _periodo_fim)
    ))
    AND (NOT _com_audiencia OR EXISTS (
      SELECT 1 FROM audiencias_detectadas ad 
      WHERE ad.processo_id = p.id
        AND (_periodo_inicio IS NULL OR ad.data_audiencia >= _periodo_inicio::date)
        AND (_periodo_fim IS NULL OR ad.data_audiencia <= _periodo_fim::date)
    ))
    AND (NOT _com_intimacao OR EXISTS (
      SELECT 1 FROM intimacoes_detectadas intim 
      WHERE intim.processo_id = p.id
        AND (_periodo_inicio IS NULL OR intim.data_intimacao >= _periodo_inicio::date)
        AND (_periodo_fim IS NULL OR intim.data_intimacao <= _periodo_fim::date)
    ))
    AND (NOT _com_tarefa OR EXISTS (
      SELECT 1 FROM tarefas t 
      WHERE t.processo_id = p.id
        AND (_periodo_inicio IS NULL OR t.data_vencimento >= _periodo_inicio::date)
        AND (_periodo_fim IS NULL OR t.data_vencimento <= _periodo_fim::date)
    ));

  -- Página
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
    p.data_distribuicao::date,
    p.coordenacao_id,
    p.pasta_id,
    p.created_at,
    CASE 
      WHEN adv.id IS NOT NULL THEN jsonb_build_object('id', adv.id, 'nome', adv.nome)
      ELSE NULL
    END as advogado_responsavel,
    CASE 
      WHEN c.id IS NOT NULL THEN jsonb_build_object('id', c.id, 'nome', c.nome)
      ELSE NULL
    END as cliente,
    p.tipo_processo,
    v_total_count as total_count
  FROM processos p
  LEFT JOIN profiles adv ON p.advogado_responsavel_id = adv.id
  LEFT JOIN clientes c ON p.cliente_id = c.id
  WHERE
    (_search IS NULL OR _search = '' OR 
      p.numero ILIKE '%' || _search || '%' OR 
      p.assunto ILIKE '%' || _search || '%' OR
      p.polo_ativo ILIKE '%' || _search || '%' OR
      p.polo_passivo ILIKE '%' || _search || '%' OR
      c.nome ILIKE '%' || _search || '%')
    AND (_area IS NULL OR p.area = _area)
    AND (_status IS NULL OR p.status::text = _status)
    AND (_coordenacao_id IS NULL OR p.coordenacao_id = _coordenacao_id)
    AND (_responsavel_id IS NULL OR p.advogado_responsavel_id = _responsavel_id)
    AND (_tipo_processo IS NULL OR p.tipo_processo = _tipo_processo)
    AND (_instancia IS NULL OR 
      (CASE 
        WHEN _instancia IN ('1', '1º Grau', '1o Grau', 'primeiro') THEN 
          p.instancia ILIKE '%1%' OR p.instancia ILIKE '%primeiro%'
        WHEN _instancia IN ('2', '2º Grau', '2o Grau', 'segundo') THEN 
          p.instancia ILIKE '%2%' OR p.instancia ILIKE '%segundo%'
        WHEN _instancia IN ('superior', 'superiores', 'STF', 'STJ', 'TST') THEN 
          p.instancia ILIKE '%super%' OR p.instancia ILIKE '%STF%' OR p.instancia ILIKE '%STJ%' OR p.instancia ILIKE '%TST%'
        ELSE p.instancia ILIKE '%' || _instancia || '%'
      END))
    AND (_cliente_ids IS NULL OR p.cliente_id = ANY(_cliente_ids))
    AND (NOT _com_movimento OR EXISTS (
      SELECT 1 FROM movimentacoes m 
      WHERE m.processo_id = p.id 
        AND (_periodo_inicio IS NULL OR m.data_movimentacao >= _periodo_inicio::date)
        AND (_periodo_fim IS NULL OR m.data_movimentacao <= _periodo_fim::date)
    ))
    AND (NOT _com_publicacao_djen OR EXISTS (
      SELECT 1 FROM publicacoes_djen_processos pdp
      WHERE pdp.processo_id = p.id
        AND (_periodo_inicio IS NULL OR pdp.data_disponibilizacao >= _periodo_inicio)
        AND (_periodo_fim IS NULL OR pdp.data_disponibilizacao <= _periodo_fim)
    ))
    AND (NOT _com_audiencia OR EXISTS (
      SELECT 1 FROM audiencias_detectadas ad 
      WHERE ad.processo_id = p.id
        AND (_periodo_inicio IS NULL OR ad.data_audiencia >= _periodo_inicio::date)
        AND (_periodo_fim IS NULL OR ad.data_audiencia <= _periodo_fim::date)
    ))
    AND (NOT _com_intimacao OR EXISTS (
      SELECT 1 FROM intimacoes_detectadas intim 
      WHERE intim.processo_id = p.id
        AND (_periodo_inicio IS NULL OR intim.data_intimacao >= _periodo_inicio::date)
        AND (_periodo_fim IS NULL OR intim.data_intimacao <= _periodo_fim::date)
    ))
    AND (NOT _com_tarefa OR EXISTS (
      SELECT 1 FROM tarefas t 
      WHERE t.processo_id = p.id
        AND (_periodo_inicio IS NULL OR t.data_vencimento >= _periodo_inicio::date)
        AND (_periodo_fim IS NULL OR t.data_vencimento <= _periodo_fim::date)
    ))
  ORDER BY p.created_at DESC
  LIMIT _page_size
  OFFSET v_offset;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_processos_paginados TO anon, authenticated, service_role;