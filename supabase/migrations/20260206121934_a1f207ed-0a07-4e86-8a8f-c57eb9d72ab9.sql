-- Criar RPC otimizada para estatísticas de tarefas por membro da equipe
-- Faz tudo em uma única query ao invés de N+1 queries
CREATE OR REPLACE FUNCTION public.get_equipe_tarefas_stats(p_coordenacao_ids uuid[])
RETURNS TABLE (
  usuario_id uuid,
  nome text,
  email text,
  cargo text,
  total_tarefas bigint,
  pendentes bigint,
  atrasadas bigint,
  cumpridas bigint,
  urgentes bigint
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_hoje date := CURRENT_DATE;
BEGIN
  RETURN QUERY
  WITH membros_unicos AS (
    -- Pega membros únicos das coordenações (sem duplicatas)
    SELECT DISTINCT ON (mc.usuario_id)
      mc.usuario_id,
      mc.cargo,
      p.nome,
      p.email
    FROM membros_coordenacao mc
    JOIN profiles p ON p.id = mc.usuario_id
    WHERE mc.coordenacao_id = ANY(p_coordenacao_ids)
    ORDER BY mc.usuario_id
  ),
  tarefas_stats AS (
    -- Agrupa estatísticas de tarefas por responsável em uma única passagem
    SELECT
      t.responsavel_id,
      COUNT(*)::bigint AS total,
      COUNT(*) FILTER (WHERE t.status = 'pendente')::bigint AS pend,
      COUNT(*) FILTER (WHERE t.status = 'cumprido')::bigint AS cumpr,
      COUNT(*) FILTER (WHERE t.status = 'pendente' AND t.prioridade = 'urgente')::bigint AS urg,
      COUNT(*) FILTER (WHERE t.status = 'pendente' AND t.data_vencimento < v_hoje)::bigint AS atras
    FROM tarefas t
    WHERE t.responsavel_id = ANY(SELECT mu.usuario_id FROM membros_unicos mu)
    GROUP BY t.responsavel_id
  )
  SELECT
    mu.usuario_id,
    mu.nome,
    mu.email,
    mu.cargo,
    COALESCE(ts.total, 0) AS total_tarefas,
    COALESCE(ts.pend, 0) AS pendentes,
    COALESCE(ts.atras, 0) AS atrasadas,
    COALESCE(ts.cumpr, 0) AS cumpridas,
    COALESCE(ts.urg, 0) AS urgentes
  FROM membros_unicos mu
  LEFT JOIN tarefas_stats ts ON ts.responsavel_id = mu.usuario_id
  ORDER BY COALESCE(ts.total, 0) DESC;
END;
$$;