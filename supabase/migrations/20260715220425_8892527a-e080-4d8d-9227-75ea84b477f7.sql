-- 1. CREATE TABLE
CREATE TABLE public.processos_testemunhas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  processo_id uuid NOT NULL REFERENCES public.processos(id) ON DELETE CASCADE,
  nome text NOT NULL,
  cpf_rg text,
  telefone text,
  email text,
  arrolada_por text,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);

CREATE INDEX idx_processos_testemunhas_processo_id ON public.processos_testemunhas(processo_id);
CREATE INDEX idx_processos_testemunhas_nome ON public.processos_testemunhas USING gin (nome gin_trgm_ops);

-- 2. GRANTS
GRANT SELECT, INSERT, UPDATE, DELETE ON public.processos_testemunhas TO authenticated;
GRANT ALL ON public.processos_testemunhas TO service_role;

-- 3. RLS
ALTER TABLE public.processos_testemunhas ENABLE ROW LEVEL SECURITY;

-- 4. POLICIES (mesmo padrão de processos_partes)
CREATE POLICY "View processos_testemunhas by processo access"
ON public.processos_testemunhas FOR SELECT
USING (is_user_active(auth.uid()) AND can_access_processo(auth.uid(), processo_id));

CREATE POLICY "Insert processos_testemunhas by processo access"
ON public.processos_testemunhas FOR INSERT
WITH CHECK (is_user_active(auth.uid()) AND can_access_processo(auth.uid(), processo_id));

CREATE POLICY "Update processos_testemunhas by processo access"
ON public.processos_testemunhas FOR UPDATE
USING (is_user_active(auth.uid()) AND can_access_processo(auth.uid(), processo_id));

CREATE POLICY "Delete processos_testemunhas by processo access"
ON public.processos_testemunhas FOR DELETE
USING (is_user_active(auth.uid()) AND can_access_processo(auth.uid(), processo_id));

-- Trigger updated_at
CREATE TRIGGER trg_processos_testemunhas_updated_at
BEFORE UPDATE ON public.processos_testemunhas
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Atualizar RPC get_processos_paginados para aceitar filtros de testemunhas
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
  _com_audiencia boolean DEFAULT false,
  _com_intimacao boolean DEFAULT false,
  _com_tarefa boolean DEFAULT false,
  _periodo_inicio timestamp with time zone DEFAULT NULL::timestamp with time zone,
  _periodo_fim timestamp with time zone DEFAULT NULL::timestamp with time zone,
  _cliente_ids uuid[] DEFAULT NULL::uuid[],
  _tipo_processo text DEFAULT NULL::text,
  _testemunha_nome text DEFAULT NULL::text,
  _com_testemunha boolean DEFAULT false
)
RETURNS TABLE(id uuid, numero text, assunto text, area text, status text, polo_ativo text, polo_passivo text, tribunal text, vara text, comarca text, valor_causa numeric, data_distribuicao date, coordenacao_id uuid, pasta_id uuid, created_at timestamp with time zone, advogado_responsavel jsonb, cliente jsonb, tipo_processo text, total_count bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_offset integer;
  v_total_count bigint;
  v_search_digits text;
BEGIN
  v_offset := (_page - 1) * _page_size;
  v_search_digits := CASE
    WHEN _search IS NULL OR _search = '' THEN NULL
    ELSE regexp_replace(_search, '\D', '', 'g')
  END;
  IF v_search_digits IS NOT NULL AND length(v_search_digits) < 4 THEN
    v_search_digits := NULL;
  END IF;

  SELECT COUNT(DISTINCT p.id) INTO v_total_count
  FROM processos p
  LEFT JOIN clientes c ON p.cliente_id = c.id
  WHERE
    (_search IS NULL OR _search = '' OR 
      p.numero ILIKE '%' || _search || '%' OR 
      p.assunto ILIKE '%' || _search || '%' OR
      p.polo_ativo ILIKE '%' || _search || '%' OR
      p.polo_passivo ILIKE '%' || _search || '%' OR
      c.nome ILIKE '%' || _search || '%' OR
      (v_search_digits IS NOT NULL AND regexp_replace(coalesce(p.numero,''), '\D', '', 'g') ILIKE '%' || v_search_digits || '%'))
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
    AND (NOT _com_testemunha OR EXISTS (
      SELECT 1 FROM processos_testemunhas pt WHERE pt.processo_id = p.id
    ))
    AND (_testemunha_nome IS NULL OR _testemunha_nome = '' OR EXISTS (
      SELECT 1 FROM processos_testemunhas pt
      WHERE pt.processo_id = p.id AND pt.nome ILIKE '%' || _testemunha_nome || '%'
    ));

  RETURN QUERY
  SELECT 
    p.id, p.numero, p.assunto, p.area, p.status::text,
    p.polo_ativo, p.polo_passivo, p.tribunal, p.vara, p.comarca,
    p.valor_causa, p.data_distribuicao::date, p.coordenacao_id, p.pasta_id, p.created_at,
    CASE WHEN pr.id IS NOT NULL THEN jsonb_build_object('id', pr.id, 'nome', pr.nome) ELSE NULL END,
    CASE WHEN c.id IS NOT NULL THEN jsonb_build_object('id', c.id, 'nome', c.nome, 'tipo', c.tipo) ELSE NULL END,
    p.tipo_processo,
    v_total_count
  FROM processos p
  LEFT JOIN profiles pr ON p.advogado_responsavel_id = pr.id
  LEFT JOIN clientes c ON p.cliente_id = c.id
  WHERE
    (_search IS NULL OR _search = '' OR 
      p.numero ILIKE '%' || _search || '%' OR 
      p.assunto ILIKE '%' || _search || '%' OR
      p.polo_ativo ILIKE '%' || _search || '%' OR
      p.polo_passivo ILIKE '%' || _search || '%' OR
      c.nome ILIKE '%' || _search || '%' OR
      (v_search_digits IS NOT NULL AND regexp_replace(coalesce(p.numero,''), '\D', '', 'g') ILIKE '%' || v_search_digits || '%'))
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
    AND (NOT _com_testemunha OR EXISTS (
      SELECT 1 FROM processos_testemunhas pt WHERE pt.processo_id = p.id
    ))
    AND (_testemunha_nome IS NULL OR _testemunha_nome = '' OR EXISTS (
      SELECT 1 FROM processos_testemunhas pt
      WHERE pt.processo_id = p.id AND pt.nome ILIKE '%' || _testemunha_nome || '%'
    ))
  ORDER BY p.created_at DESC
  LIMIT _page_size OFFSET v_offset;
END;
$function$;