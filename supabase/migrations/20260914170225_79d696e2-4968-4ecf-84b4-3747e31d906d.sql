WITH a AS (
  SELECT dados_benner_id, created_at, jsonb_array_elements(campos_alterados) c
  FROM auditoria_distribuicao_tst
), perdas AS (
  SELECT dados_benner_id, created_at, c->>'de' AS valor
  FROM a
  WHERE c->>'campo' = 'tipo_recurso_terceiro'
    AND (c->>'para') IS NULL
    AND (c->>'de') IS NOT NULL
), ultima AS (
  SELECT DISTINCT ON (dados_benner_id) dados_benner_id, valor
  FROM perdas ORDER BY dados_benner_id, created_at DESC
)
UPDATE public.dados_benner d
SET tipo_recurso_terceiro = u.valor
FROM ultima u
WHERE d.id = u.dados_benner_id
  AND (d.tipo_recurso_terceiro IS NULL OR d.tipo_recurso_terceiro = '');