-- RPC: contagens per-user (total e não lidas) para Análise DJEN.
-- "Não lidas" = publicações da janela cuja existência NÃO consta em publicacoes_djen_leituras
-- para o usuário autenticado. Espelha a lógica do mergeWithLeituras no client.

CREATE OR REPLACE FUNCTION public.get_djen_stats_per_user(
  p_coordenacao_id uuid DEFAULT NULL,
  p_inicio timestamptz DEFAULT NULL,
  p_fim timestamptz DEFAULT NULL
)
RETURNS TABLE(
  total_termos bigint,
  total_processos bigint,
  nao_lidas_termos bigint,
  nao_lidas_processos bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '28000';
  END IF;

  -- RBAC: se uma coordenação foi pedida e o usuário não é admin/coordenador,
  -- precisa ser membro daquela coordenação.
  IF p_coordenacao_id IS NOT NULL
     AND NOT public.is_admin_or_coordenador(v_uid)
     AND NOT EXISTS (
       SELECT 1 FROM public.membros_coordenacao mc
       WHERE mc.coordenacao_id = p_coordenacao_id AND mc.usuario_id = v_uid
     )
  THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  WITH
    pt AS (
      SELECT pd.id
      FROM public.publicacoes_djen pd
      WHERE (p_coordenacao_id IS NULL OR pd.coordenacao_id = p_coordenacao_id)
        AND (p_inicio IS NULL OR pd.created_at >= p_inicio)
        AND (p_fim    IS NULL OR pd.created_at <= p_fim)
    ),
    pp AS (
      SELECT pdp.id
      FROM public.publicacoes_djen_processos pdp
      WHERE (p_coordenacao_id IS NULL OR pdp.coordenacao_id = p_coordenacao_id)
        AND (p_inicio IS NULL OR pdp.created_at >= p_inicio)
        AND (p_fim    IS NULL OR pdp.created_at <= p_fim)
    )
  SELECT
    (SELECT count(*) FROM pt)::bigint AS total_termos,
    (SELECT count(*) FROM pp)::bigint AS total_processos,
    (SELECT count(*) FROM pt
       WHERE NOT EXISTS (
         SELECT 1 FROM public.publicacoes_djen_leituras l
         WHERE l.publicacao_id = pt.id
           AND l.tabela_origem = 'termo'
           AND l.usuario_id = v_uid
       )
    )::bigint AS nao_lidas_termos,
    (SELECT count(*) FROM pp
       WHERE NOT EXISTS (
         SELECT 1 FROM public.publicacoes_djen_leituras l
         WHERE l.publicacao_id = pp.id
           AND l.tabela_origem = 'processo'
           AND l.usuario_id = v_uid
       )
    )::bigint AS nao_lidas_processos;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_djen_stats_per_user(uuid, timestamptz, timestamptz) TO authenticated;