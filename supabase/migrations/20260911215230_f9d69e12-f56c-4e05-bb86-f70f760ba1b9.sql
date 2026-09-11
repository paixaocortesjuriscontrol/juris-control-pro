DELETE FROM public.dados_benner_processo_tags pt
USING public.processo_tags_catalogo t
WHERE t.id = pt.tag_id
  AND t.nome = 'Base Ativa PCA'
  AND pt.created_at >= '2026-09-11 21:44:00+00'
  AND pt.created_at <  '2026-09-11 21:50:00+00';