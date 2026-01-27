
-- Criar função RPC para contar publicações por monitoramento de forma eficiente
CREATE OR REPLACE FUNCTION get_publicacoes_contagens_por_monitoramento()
RETURNS TABLE (
  monitoramento_id UUID,
  total BIGINT,
  nao_lidas BIGINT
) 
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT 
    p.monitoramento_id,
    COUNT(*)::BIGINT as total,
    COUNT(*) FILTER (WHERE NOT p.lida)::BIGINT as nao_lidas
  FROM publicacoes_djen p
  GROUP BY p.monitoramento_id;
$$;

-- Dar permissão para usuários autenticados
GRANT EXECUTE ON FUNCTION get_publicacoes_contagens_por_monitoramento() TO authenticated;
