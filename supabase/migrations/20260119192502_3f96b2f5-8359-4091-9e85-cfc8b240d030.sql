-- Corrige a RPC get_processos_paginados:
-- 1) remove TODAS as sobrecargas (PostgREST/Supabase RPC não lida bem com overload)
-- 2) recria UMA única função com assinatura completa
-- 3) garante tipos corretos (p.status::text) para não quebrar a listagem

DO $$
DECLARE r record;
BEGIN
  FOR r IN (
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'get_processos_paginados'
  ) LOOP
    EXECUTE format('DROP FUNCTION IF EXISTS %s;', r.sig);
  END LOOP;
END $$;

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
SET search_path = public
AS $$
DECLARE
  v_total_count bigint;
  v_offset integer;
BEGIN
  v_offset := GREATEST((_page - 1), 0) * GREATEST(_page_size, 1);

  SELECT COUNT(*)
  INTO v_total_count
  FROM public.processos p
  WHERE
    (_area IS NULL OR _area = 'all' OR p.area = _area)
    AND (_status IS NULL OR _status = 'all' OR p.status::text = _status)
    AND (_coordenacao_id IS NULL OR p.coordenacao_id = _coordenacao_id)
    AND (_responsavel_id IS NULL OR p.advogado_responsavel_id = _responsavel_id)
    AND (_instancia IS NULL OR _instancia = 'todos' OR (
      CASE _instancia
        WHEN '1' THEN p.instancia = '1º Instância'
        WHEN '2' THEN p.instancia = '2º Instância'
        WHEN 'superior' THEN p.instancia = 'Tribunais Superiores'
        ELSE true
      END
    ))
    AND (_periodo_inicio IS NULL OR p.created_at >= _periodo_inicio)
    AND (_periodo_fim IS NULL OR p.created_at <= _periodo_fim)
    AND (_search IS NULL OR (
      p.numero ILIKE ('%' || _search || '%')
      OR COALESCE(p.polo_ativo,'') ILIKE ('%' || _search || '%')
      OR COALESCE(p.polo_passivo,'') ILIKE ('%' || _search || '%')
    ))
    AND (NOT _com_publicacao_djen OR EXISTS (
      SELECT 1 FROM public.publicacoes_djen_processos pd WHERE pd.processo_id = p.id
    ))
    AND (NOT _com_movimento OR EXISTS (
      SELECT 1 FROM public.movimentacoes m WHERE m.processo_id = p.id
    ))
    AND (NOT _com_audiencia OR EXISTS (
      SELECT 1 FROM public.audiencias_detectadas ad WHERE ad.processo_id = p.id OR ad.processo_numero = p.numero
    ))
    AND (NOT _com_intimacao OR EXISTS (
      SELECT 1 FROM public.intimacoes_detectadas i WHERE i.processo_id = p.id OR i.processo_numero = p.numero
    ))
    AND (NOT _com_tarefa OR EXISTS (
      SELECT 1 FROM public.tarefas t WHERE t.processo_id = p.id
    ))
    AND (_cliente_ids IS NULL OR p.cliente_id = ANY(_cliente_ids))
    AND (_tipo_processo IS NULL OR _tipo_processo = 'all' OR p.tipo_processo = _tipo_processo);

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
    CASE WHEN pr.id IS NULL THEN NULL ELSE jsonb_build_object('id', pr.id, 'nome', pr.nome) END AS advogado_responsavel,
    CASE WHEN c.id IS NULL THEN NULL ELSE jsonb_build_object('id', c.id, 'nome', c.nome, 'tipo', c.tipo) END AS cliente,
    p.tipo_processo,
    v_total_count AS total_count
  FROM public.processos p
  LEFT JOIN public.profiles pr ON pr.id = p.advogado_responsavel_id
  LEFT JOIN public.clientes c ON c.id = p.cliente_id
  WHERE
    (_area IS NULL OR _area = 'all' OR p.area = _area)
    AND (_status IS NULL OR _status = 'all' OR p.status::text = _status)
    AND (_coordenacao_id IS NULL OR p.coordenacao_id = _coordenacao_id)
    AND (_responsavel_id IS NULL OR p.advogado_responsavel_id = _responsavel_id)
    AND (_instancia IS NULL OR _instancia = 'todos' OR (
      CASE _instancia
        WHEN '1' THEN p.instancia = '1º Instância'
        WHEN '2' THEN p.instancia = '2º Instância'
        WHEN 'superior' THEN p.instancia = 'Tribunais Superiores'
        ELSE true
      END
    ))
    AND (_periodo_inicio IS NULL OR p.created_at >= _periodo_inicio)
    AND (_periodo_fim IS NULL OR p.created_at <= _periodo_fim)
    AND (_search IS NULL OR (
      p.numero ILIKE ('%' || _search || '%')
      OR COALESCE(p.polo_ativo,'') ILIKE ('%' || _search || '%')
      OR COALESCE(p.polo_passivo,'') ILIKE ('%' || _search || '%')
    ))
    AND (NOT _com_publicacao_djen OR EXISTS (
      SELECT 1 FROM public.publicacoes_djen_processos pd WHERE pd.processo_id = p.id
    ))
    AND (NOT _com_movimento OR EXISTS (
      SELECT 1 FROM public.movimentacoes m WHERE m.processo_id = p.id
    ))
    AND (NOT _com_audiencia OR EXISTS (
      SELECT 1 FROM public.audiencias_detectadas ad WHERE ad.processo_id = p.id OR ad.processo_numero = p.numero
    ))
    AND (NOT _com_intimacao OR EXISTS (
      SELECT 1 FROM public.intimacoes_detectadas i WHERE i.processo_id = p.id OR i.processo_numero = p.numero
    ))
    AND (NOT _com_tarefa OR EXISTS (
      SELECT 1 FROM public.tarefas t WHERE t.processo_id = p.id
    ))
    AND (_cliente_ids IS NULL OR p.cliente_id = ANY(_cliente_ids))
    AND (_tipo_processo IS NULL OR _tipo_processo = 'all' OR p.tipo_processo = _tipo_processo)
  ORDER BY p.created_at DESC
  LIMIT GREATEST(_page_size, 1)
  OFFSET v_offset;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_processos_paginados(
  integer, integer, text, text, text, uuid, uuid, text,
  boolean, boolean, boolean, boolean, boolean,
  timestamp with time zone, timestamp with time zone,
  uuid[], text
) TO anon, authenticated, service_role;