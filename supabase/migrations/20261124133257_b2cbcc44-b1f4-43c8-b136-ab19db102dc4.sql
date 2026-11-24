CREATE OR REPLACE FUNCTION public.get_publicacoes_mesma_comunicacao(p_ids_termos uuid[] DEFAULT NULL, p_ids_processos uuid[] DEFAULT NULL, p_ids_descartadas uuid[] DEFAULT NULL)
RETURNS TABLE(publicacao_id uuid, tabela_origem text)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO 'public'
AS $$
  WITH seeds AS (
    SELECT pd.id, 'termo'::text t, NULLIF(btrim(pd.id_djen),'') idj, COALESCE(pd.coordenacao_id, md.coordenacao_id) coord
    FROM publicacoes_djen pd LEFT JOIN monitoramentos_djen md ON md.id = pd.monitoramento_id
    WHERE pd.id = ANY(COALESCE(p_ids_termos, '{}'))
    UNION ALL
    SELECT pdp.id, 'processo', NULLIF(btrim(pdp.id_djen),''), COALESCE(pdp.coordenacao_id, p.coordenacao_id)
    FROM publicacoes_djen_processos pdp LEFT JOIN processos p ON p.id = pdp.processo_id
    WHERE pdp.id = ANY(COALESCE(p_ids_processos, '{}'))
    UNION ALL
    SELECT pdd.id, 'descartada', NULLIF(btrim(pdd.id_djen),''), COALESCE(pdd.coordenacao_id, md.coordenacao_id)
    FROM publicacoes_djen_descartadas pdd LEFT JOIN monitoramentos_djen md ON md.id = pdd.monitoramento_id
    WHERE pdd.id = ANY(COALESCE(p_ids_descartadas, '{}'))
  ), ks AS (SELECT DISTINCT idj, coord FROM seeds WHERE idj IS NOT NULL)
  SELECT id, t FROM seeds
  UNION
  SELECT pd.id, 'termo' FROM ks JOIN publicacoes_djen pd ON btrim(pd.id_djen) = ks.idj
    LEFT JOIN monitoramentos_djen md ON md.id = pd.monitoramento_id
    WHERE COALESCE(pd.coordenacao_id, md.coordenacao_id) IS NOT DISTINCT FROM ks.coord
  UNION
  SELECT pdp.id, 'processo' FROM ks JOIN publicacoes_djen_processos pdp ON btrim(pdp.id_djen) = ks.idj
    LEFT JOIN processos p ON p.id = pdp.processo_id
    WHERE COALESCE(pdp.coordenacao_id, p.coordenacao_id) IS NOT DISTINCT FROM ks.coord
  UNION
  SELECT pdd.id, 'descartada' FROM ks JOIN publicacoes_djen_descartadas pdd ON btrim(pdd.id_djen) = ks.idj
    LEFT JOIN monitoramentos_djen md ON md.id = pdd.monitoramento_id
    WHERE COALESCE(pdd.coordenacao_id, md.coordenacao_id) IS NOT DISTINCT FROM ks.coord;
$$;
GRANT EXECUTE ON FUNCTION public.get_publicacoes_mesma_comunicacao(uuid[], uuid[], uuid[]) TO authenticated;