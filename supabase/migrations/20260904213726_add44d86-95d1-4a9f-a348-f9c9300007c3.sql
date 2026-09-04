CREATE INDEX IF NOT EXISTS idx_pedidos_por_dossie_dossie ON public.pedidos_por_dossie (dossie);

CREATE OR REPLACE FUNCTION public.get_pedidos_por_dossie_agrupados(p_offset integer DEFAULT 0, p_limit integer DEFAULT 3000)
RETURNS TABLE(dossie text, pedidos text[], pedidos_normalizados text[])
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.dossie,
         array_agg(p.pedido ORDER BY p.pedido) AS pedidos,
         array_agg(COALESCE(p.pedido_normalizado, '') ORDER BY p.pedido) AS pedidos_normalizados
  FROM public.pedidos_por_dossie p
  WHERE p.dossie IS NOT NULL AND btrim(p.dossie) <> ''
  GROUP BY p.dossie
  ORDER BY p.dossie
  OFFSET GREATEST(COALESCE(p_offset, 0), 0)
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 3000), 1), 10000)
$$;

GRANT EXECUTE ON FUNCTION public.get_pedidos_por_dossie_agrupados(integer, integer) TO authenticated;