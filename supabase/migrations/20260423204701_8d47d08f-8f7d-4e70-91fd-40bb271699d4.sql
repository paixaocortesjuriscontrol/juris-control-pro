UPDATE public.monitoramentos_djen md
SET tribunais = norm.tribunais_normalizados
FROM (
  SELECT
    id,
    CASE
      WHEN COUNT(*) FILTER (WHERE tribunal_normalizado IS NOT NULL) = 0 THEN NULL::text[]
      ELSE array_agg(DISTINCT tribunal_normalizado ORDER BY tribunal_normalizado)
           FILTER (WHERE tribunal_normalizado IS NOT NULL)
    END AS tribunais_normalizados
  FROM (
    SELECT
      md.id,
      NULLIF(UPPER(BTRIM(t)), '') AS tribunal_normalizado
    FROM public.monitoramentos_djen md
    JOIN public.coordenacoes c ON c.id = md.coordenacao_id
    LEFT JOIN LATERAL unnest(COALESCE(md.tribunais, ARRAY[]::text[])) AS t ON TRUE
    WHERE unaccent(upper(c.nome)) LIKE unaccent('%JANAINA%')
  ) x
  GROUP BY id
) norm
WHERE md.id = norm.id
  AND md.tribunais IS DISTINCT FROM norm.tribunais_normalizados;