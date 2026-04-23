
WITH eduardo AS (
  SELECT id FROM public.profiles_basic WHERE nome ILIKE '%eduardo torres%' LIMIT 1
),
pares AS (
  SELECT DISTINCT db.id AS dados_benner_id, (SELECT id FROM eduardo) AS usuario_id
  FROM public.dados_benner_judit_temp t
  JOIN public.dados_benner_judit_temp_responsaveis r ON r.dados_benner_id = t.id
  JOIN eduardo e ON e.id = r.usuario_id
  JOIN public.dados_benner db ON db.processo = t.processo
  WHERE (SELECT id FROM eduardo) IS NOT NULL
)
INSERT INTO public.dados_benner_responsaveis (dados_benner_id, usuario_id)
SELECT dados_benner_id, usuario_id FROM pares
ON CONFLICT DO NOTHING;
