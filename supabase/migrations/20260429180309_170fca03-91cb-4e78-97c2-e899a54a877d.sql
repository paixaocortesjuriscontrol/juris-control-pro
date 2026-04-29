-- Atualiza get_djen_stats_per_user para excluir publicações com fonte 'dejt-pdf'
-- quando o filtro p_tipo_origem NÃO é 'djet-pautas'.
-- Sem essa exclusão, o totalizador do header conta 1 a mais que a lista,
-- que já filtra essas pautas no client (espelhando o comportamento da
-- RPC get_djen_publicacoes_unificadas).

CREATE OR REPLACE FUNCTION public.get_djen_stats_per_user(
  p_coordenacao_id uuid DEFAULT NULL::uuid,
  p_inicio timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_fim timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_tipo_origem text DEFAULT NULL::text,
  p_search_query text DEFAULT NULL::text,
  p_monitoramento_id uuid DEFAULT NULL::uuid
)
RETURNS TABLE(total_termos bigint, total_processos bigint, nao_lidas_termos bigint, nao_lidas_processos bigint)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '25s'
AS $function$
DECLARE
  v_uid uuid; v_q text; v_q_digits text; v_tipo text;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not authenticated' USING ERRCODE = '28000'; END IF;
  IF p_coordenacao_id IS NOT NULL
     AND NOT public.is_admin_or_coordenador(v_uid)
     AND NOT EXISTS (SELECT 1 FROM public.membros_coordenacao mc WHERE mc.coordenacao_id = p_coordenacao_id AND mc.usuario_id = v_uid)
  THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;

  v_tipo := NULLIF(btrim(COALESCE(p_tipo_origem, '')), '');
  IF v_tipo = 'todos' THEN v_tipo := NULL; END IF;
  v_q := NULLIF(btrim(COALESCE(p_search_query, '')), '');
  v_q_digits := CASE WHEN v_q IS NOT NULL THEN regexp_replace(v_q, '[^0-9]', '', 'g') ELSE NULL END;
  IF v_q_digits IS NOT NULL AND length(v_q_digits) < 5 THEN v_q_digits := NULL; END IF;

  RETURN QUERY
  WITH base AS (
    SELECT pd.id, 'termo'::text AS tipo_origem, pd.created_at,
      pd.coordenacao_id AS dedup_coord, pd.dedup_processo_digits, pd.dedup_data_ref, pd.dedup_head_norm,
      CASE WHEN md.tipo = 'parte' THEN 0 ELSE 1 END AS prio
    FROM public.publicacoes_djen pd
    JOIN public.monitoramentos_djen md ON md.id = pd.monitoramento_id
    WHERE (p_coordenacao_id IS NULL OR pd.coordenacao_id = p_coordenacao_id)
      AND pd.status = 'encontrada'
      AND (v_tipo IS NULL OR v_tipo IN ('termo', 'parte', 'djet-pautas'))
      AND (v_tipo IS DISTINCT FROM 'parte' OR md.tipo = 'parte')
      -- Pautas DEJT (fonte 'dejt-pdf') só contam quando o filtro é 'djet-pautas'.
      -- Em qualquer outro filtro, são ocultadas (mesmo comportamento da lista).
      AND (
        v_tipo = 'djet-pautas'
        OR COALESCE(pd.fonte, '') <> 'dejt-pdf'
      )
      -- E inversamente: 'djet-pautas' SÓ traz publicações com fonte 'dejt-pdf'.
      AND (v_tipo IS DISTINCT FROM 'djet-pautas' OR pd.fonte = 'dejt-pdf')
      AND (p_monitoramento_id IS NULL OR pd.monitoramento_id = p_monitoramento_id)
      AND (p_inicio IS NULL OR pd.created_at >= p_inicio)
      AND (p_fim    IS NULL OR pd.created_at <= p_fim)
      AND (
        v_q IS NULL
        OR pd.processo_numero ILIKE ('%' || v_q || '%')
        OR md.termo_busca ILIKE ('%' || v_q || '%')
        OR (v_q_digits IS NOT NULL AND regexp_replace(COALESCE(pd.processo_numero, ''), '[^0-9]', '', 'g') LIKE ('%' || v_q_digits || '%'))
        OR pd.conteudo ILIKE ('%' || v_q || '%')
      )

    UNION ALL

    SELECT pdp.id, 'processo'::text AS tipo_origem, pdp.created_at,
      pdp.coordenacao_id AS dedup_coord, pdp.dedup_processo_digits, pdp.dedup_data_ref, pdp.dedup_head_norm,
      2 AS prio
    FROM public.publicacoes_djen_processos pdp
    LEFT JOIN public.processos pr ON pr.id = pdp.processo_id
    WHERE (p_coordenacao_id IS NULL OR pdp.coordenacao_id = p_coordenacao_id)
      AND pdp.status = 'encontrada'
      AND (v_tipo IS NULL OR v_tipo = 'processo')
      AND p_monitoramento_id IS NULL
      AND (p_inicio IS NULL OR pdp.created_at >= p_inicio)
      AND (p_fim    IS NULL OR pdp.created_at <= p_fim)
      AND (
        v_q IS NULL
        OR pdp.processo_numero ILIKE ('%' || v_q || '%')
        OR (v_q_digits IS NOT NULL AND regexp_replace(COALESCE(pdp.processo_numero, ''), '[^0-9]', '', 'g') LIKE ('%' || v_q_digits || '%'))
        OR pdp.conteudo ILIKE ('%' || v_q || '%')
        OR COALESCE(pr.polo_ativo, '') ILIKE ('%' || v_q || '%')
        OR COALESCE(pr.polo_passivo, '') ILIKE ('%' || v_q || '%')
      )
  ),
  ranked AS (
    SELECT DISTINCT ON (b.dedup_coord, b.dedup_processo_digits, b.dedup_data_ref, b.dedup_head_norm)
      b.id, b.tipo_origem
    FROM base b
    ORDER BY b.dedup_coord, b.dedup_processo_digits, b.dedup_data_ref, b.dedup_head_norm, b.prio, b.created_at DESC, b.id DESC
  )
  SELECT
    COUNT(*) FILTER (WHERE r.tipo_origem = 'termo')::bigint,
    COUNT(*) FILTER (WHERE r.tipo_origem = 'processo')::bigint,
    COUNT(*) FILTER (WHERE r.tipo_origem = 'termo' AND NOT EXISTS (SELECT 1 FROM public.publicacoes_djen_leituras l WHERE l.publicacao_id = r.id AND l.tabela_origem = r.tipo_origem AND l.usuario_id = v_uid))::bigint,
    COUNT(*) FILTER (WHERE r.tipo_origem = 'processo' AND NOT EXISTS (SELECT 1 FROM public.publicacoes_djen_leituras l WHERE l.publicacao_id = r.id AND l.tabela_origem = r.tipo_origem AND l.usuario_id = v_uid))::bigint
  FROM ranked r;
END;
$function$;