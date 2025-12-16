-- Create a security definer function to get process counts by coordination
-- This allows all authenticated users to see aggregate coordination stats
CREATE OR REPLACE FUNCTION public.get_coordenacao_stats()
RETURNS TABLE (
  coordenacao_id uuid,
  coordenacao_nome text,
  total_processos bigint,
  processos_distribuidos bigint,
  processos_nao_distribuidos bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    c.id as coordenacao_id,
    c.nome as coordenacao_nome,
    COUNT(p.id) as total_processos,
    COUNT(p.id) FILTER (WHERE p.advogado_responsavel_id IS NOT NULL) as processos_distribuidos,
    COUNT(p.id) FILTER (WHERE p.advogado_responsavel_id IS NULL) as processos_nao_distribuidos
  FROM coordenacoes c
  LEFT JOIN processos p ON p.coordenacao_id = c.id
  GROUP BY c.id, c.nome
  ORDER BY c.nome
$$;