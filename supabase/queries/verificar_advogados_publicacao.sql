SELECT
  pd.id,
  pd.processo_numero,
  pd.data_publicacao,
  length(pd.conteudo) AS conteudo_len,
  (pd.partes_json IS NOT NULL AND jsonb_typeof(pd.partes_json::jsonb) = 'array' AND jsonb_array_length(pd.partes_json::jsonb) > 0) AS tem_partes,
  (pd.advogados_json IS NOT NULL AND jsonb_typeof(pd.advogados_json::jsonb) = 'array' AND jsonb_array_length(pd.advogados_json::jsonb) > 0) AS tem_advogados,
  pd.partes_json,
  pd.advogados_json,
  left(pd.conteudo, 400) AS conteudo_inicio
FROM publicacoes_djen pd
ORDER BY pd.created_at DESC
LIMIT 1;

SELECT
  pdp.id,
  pdp.processo_numero,
  pdp.data_publicacao,
  length(pdp.conteudo) AS conteudo_len,
  (pdp.partes_json IS NOT NULL AND jsonb_typeof(pdp.partes_json::jsonb) = 'array' AND jsonb_array_length(pdp.partes_json::jsonb) > 0) AS tem_partes,
  (pdp.advogados_json IS NOT NULL AND jsonb_typeof(pdp.advogados_json::jsonb) = 'array' AND jsonb_array_length(pdp.advogados_json::jsonb) > 0) AS tem_advogados,
  pdp.partes_json,
  pdp.advogados_json,
  left(pdp.conteudo, 400) AS conteudo_inicio
FROM publicacoes_djen_processos pdp
ORDER BY pdp.created_at DESC
LIMIT 1;
