
-- Limpar whitespace residual nos nomes de advogados do backfill
UPDATE publicacoes_djen
SET advogados_json = (
  SELECT jsonb_agg(btrim(elem #>> '{}', E'\n\r\t '))
  FROM jsonb_array_elements(advogados_json) AS elem
)
WHERE advogados_json IS NOT NULL 
  AND advogados_json::text ~ E'\\\\n|\\\\r|\\\\t';
