-- Recriar a função get_processos_paginados com suporte a filtro por lista de cliente_ids
CREATE OR REPLACE FUNCTION public.get_processos_paginados(
  _page integer DEFAULT 1, 
  _page_size integer DEFAULT 50, 
  _search text DEFAULT NULL::text, 
  _area text DEFAULT NULL::text, 
  _status text DEFAULT NULL::text, 
  _coordenacao_id uuid DEFAULT NULL::uuid, 
  _responsavel_id uuid DEFAULT NULL::uuid, 
  _instancia text DEFAULT NULL::text, 
  _com_movimento boolean DEFAULT false, 
  _com_publicacao_djen boolean DEFAULT false, 
  _periodo_inicio timestamp with time zone DEFAULT NULL::timestamp with time zone, 
  _periodo_fim timestamp with time zone DEFAULT NULL::timestamp with time zone,
  _cliente_ids uuid[] DEFAULT NULL::uuid[]
)
 RETURNS TABLE(id uuid, numero text, assunto text, area text, status status_processo, polo_ativo text, polo_passivo text, tribunal text, vara text, comarca text, valor_causa numeric, data_distribuicao date, coordenacao_id uuid, pasta_id uuid, created_at timestamp with time zone, advogado_responsavel jsonb, cliente jsonb, total_count bigint)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  WITH base AS (
    SELECT
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
      jsonb_build_object('id', pr.id, 'nome', pr.nome) AS advogado_responsavel,
      jsonb_build_object('id', c.id, 'nome', c.nome, 'tipo', c.tipo) AS cliente
    FROM public.processos p
    LEFT JOIN public.profiles pr ON pr.id = p.advogado_responsavel_id
    LEFT JOIN public.clientes c ON c.id = p.cliente_id
    WHERE
      (
        _area IS NULL OR _area = 'all' OR p.area = _area
      )
      AND (
        _status IS NULL OR _status = 'all' OR p.status::text = _status
      )
      AND (
        _coordenacao_id IS NULL OR _coordenacao_id::text = 'all' OR p.coordenacao_id = _coordenacao_id
      )
      AND (
        _responsavel_id IS NULL OR p.advogado_responsavel_id = _responsavel_id
      )
      AND (
        _instancia IS NULL OR _instancia = 'todos' OR (
          CASE _instancia
            WHEN '1' THEN p.instancia = '1º Instância'
            WHEN '2' THEN p.instancia = '2º Instância'
            WHEN 'superior' THEN p.instancia = 'Tribunais Superiores'
            ELSE true
          END
        )
      )
      AND (
        _periodo_inicio IS NULL OR p.created_at >= _periodo_inicio
      )
      AND (
        _periodo_fim IS NULL OR p.created_at <= _periodo_fim
      )
      AND (
        _search IS NULL OR (
          p.numero ILIKE ('%' || _search || '%')
          OR COALESCE(p.polo_ativo,'') ILIKE ('%' || _search || '%')
          OR COALESCE(p.polo_passivo,'') ILIKE ('%' || _search || '%')
        )
      )
      AND (
        NOT _com_publicacao_djen
        OR EXISTS (
          SELECT 1 FROM public.publicacoes_djen_processos pd
          WHERE pd.processo_id = p.id
        )
      )
      AND (
        NOT _com_movimento
        OR EXISTS (
          SELECT 1 FROM public.movimentacoes m
          WHERE m.processo_id = p.id
        )
      )
      AND (
        _cliente_ids IS NULL OR p.cliente_id = ANY(_cliente_ids)
      )
  )
  SELECT
    b.*,
    COUNT(*) OVER () AS total_count
  FROM base b
  ORDER BY b.created_at DESC
  LIMIT GREATEST(_page_size, 1)
  OFFSET GREATEST((_page - 1), 0) * GREATEST(_page_size, 1);
$function$;