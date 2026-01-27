-- RPC para contagens por monitoramento em um período (evita SELECT direto com RLS)
CREATE OR REPLACE FUNCTION public.get_publicacoes_contagens_por_monitoramento_periodo(
  p_inicio timestamptz,
  p_fim timestamptz
)
RETURNS TABLE(
  monitoramento_id uuid,
  total bigint,
  nao_lidas bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    p.monitoramento_id,
    COUNT(*)::bigint AS total,
    COUNT(*) FILTER (WHERE NOT p.lida)::bigint AS nao_lidas
  FROM public.publicacoes_djen p
  WHERE p.created_at >= p_inicio
    AND p.created_at < p_fim
  GROUP BY p.monitoramento_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_publicacoes_contagens_por_monitoramento_periodo(timestamptz, timestamptz) TO authenticated;
