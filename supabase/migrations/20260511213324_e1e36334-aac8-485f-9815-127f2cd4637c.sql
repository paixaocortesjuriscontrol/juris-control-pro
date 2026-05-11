DELETE FROM public.dados_benner
WHERE centralizador IS NOT NULL
  AND centralizador <> '0'
  AND lower(unaccent(centralizador)) NOT LIKE '%paixao cortes%';