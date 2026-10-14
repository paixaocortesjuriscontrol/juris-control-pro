CREATE OR REPLACE FUNCTION public.get_ranking_publicacoes(p_inicio date, p_fim date, p_coordenacao_id uuid DEFAULT NULL, p_usuario_id uuid DEFAULT NULL)
RETURNS TABLE(usuario_id uuid, nome text, publicacoes_tratadas bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
WITH acoes AS (
  SELECT l.usuario_id uid, l.publicacao_id pid,
    COALESCE(t.coordenacao_id, md.coordenacao_id, pp.coordenacao_id, d.coordenacao_id, dd.coordenacao_id) coord
  FROM public.publicacoes_djen_leituras l
  LEFT JOIN public.publicacoes_djen t ON l.tabela_origem='termo' AND t.id=l.publicacao_id
  LEFT JOIN public.monitoramentos_djen md ON md.id=t.monitoramento_id
  LEFT JOIN public.publicacoes_djen_processos pp ON l.tabela_origem='processo' AND pp.id=l.publicacao_id
  LEFT JOIN public.publicacoes_djen_descartadas d ON l.tabela_origem='descartada' AND d.id=l.publicacao_id
  LEFT JOIN public.publicacoes_djen_descartadas dd ON l.tabela_origem IN ('termo','processo') AND t.id IS NULL AND pp.id IS NULL AND dd.id_origem=l.publicacao_id
  WHERE (l.lida_em AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN p_inicio AND p_fim
  UNION ALL
  SELECT d.descartado_por, COALESCE(d.id_origem, d.id), d.coordenacao_id
  FROM public.publicacoes_djen_descartadas d
  WHERE d.descartado_por IS NOT NULL
    AND (d.created_at AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN p_inicio AND p_fim
)
SELECT a.uid, COALESCE(NULLIF(trim(p.nome),''), p.email), count(DISTINCT a.pid)
FROM acoes a LEFT JOIN public.profiles p ON p.id=a.uid
WHERE a.uid IS NOT NULL
  AND (p_coordenacao_id IS NULL OR a.coord=p_coordenacao_id)
  AND (p_usuario_id IS NULL OR a.uid=p_usuario_id)
GROUP BY a.uid, p.nome, p.email;
$$;
GRANT EXECUTE ON FUNCTION public.get_ranking_publicacoes(date,date,uuid,uuid) TO authenticated;