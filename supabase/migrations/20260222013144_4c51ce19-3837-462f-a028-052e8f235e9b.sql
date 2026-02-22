
-- Backfill advogados_json: capturar padrão "ADVOGADO: NOME" do texto
-- para publicações que não têm advogados_json preenchido
UPDATE publicacoes_djen
SET advogados_json = (
  SELECT jsonb_agg(DISTINCT trim(match_text))
  FROM (
    SELECT (regexp_matches(conteudo, '(?:ADVOGADO|ADV\.?)\s*:\s*([A-ZÁÉÍÓÚÂÊÔÃÕÇ][A-Za-záéíóúâêôãõçÁÉÍÓÚÂÊÔÃÕÇ\s.]+?)(?=\s*(?:Embarg|Reclamant|Reclamad|Requerent|Requerid|Autor|Réu|Agravant|Agravad|Apelant|Apelad|Execu|ADVOGADO|ADV[.:]|OAB|\d{7}|$))', 'gi'))[1] AS match_text
  ) sub
  WHERE match_text IS NOT NULL 
    AND length(trim(match_text)) >= 5
    AND match_text !~* '\b(BANCO|S\.A\.|S/A|LTDA|EIRELI|SINDICATO|MUNICIPIO|ESTADO|UNIÃO|INSTITUTO|FUNDAÇÃO)\b'
)
WHERE (advogados_json IS NULL OR advogados_json::text = 'null' OR advogados_json::text = '[]')
  AND conteudo ~* '(?:ADVOGADO|ADV\.?)\s*:\s*[A-Z]';
