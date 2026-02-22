-- Backfill: preencher orgao, tipo_comunicacao, meio para publicações que não têm esses campos
-- Extrai dos cabeçalhos formatados no campo conteudo

-- 1. Orgao (ex: "Órgão: 3ª Turma")
UPDATE publicacoes_djen
SET orgao = trim(substring(conteudo from 'Órgão:\s*([^\n\r]+)'))
WHERE orgao IS NULL
  AND conteudo ~ 'Órgão:\s*[^\n\r]+';

-- 2. Tipo de comunicação (ex: "Tipo de comunicação: Intimação")
UPDATE publicacoes_djen
SET tipo_comunicacao = trim(substring(conteudo from 'Tipo de comunica[çc][ãa]o:\s*([^\n\r]+)'))
WHERE tipo_comunicacao IS NULL
  AND conteudo ~ 'Tipo de comunica';

-- 3. Meio (ex: "Meio: D" ou "Meio: Diário de Justiça Eletrônico Nacional")
UPDATE publicacoes_djen
SET meio = trim(substring(conteudo from 'Meio:\s*([^\n\r]+)'))
WHERE meio IS NULL
  AND conteudo ~ 'Meio:\s*[^\n\r]+';

-- 4. Backfill advogados_json a partir de padrões OAB no texto
-- Extrai advogados no formato "NOME - OAB UF-NUMERO" do conteudo
-- Usa regex para encontrar padrões OAB comuns
UPDATE publicacoes_djen
SET advogados_json = (
  SELECT jsonb_agg(DISTINCT match_text)
  FROM (
    SELECT (regexp_matches(conteudo, '([A-ZÁÉÍÓÚÂÊÔÃÕÇ][A-Za-záéíóúâêôãõç\s]+?)\s*[-–—]\s*OAB\s*/?([A-Z]{2})[-\s]*(\d{1,10})', 'g'))[1]
      || ' - OAB '
      || (regexp_matches(conteudo, '([A-ZÁÉÍÓÚÂÊÔÃÕÇ][A-Za-záéíóúâêôãõç\s]+?)\s*[-–—]\s*OAB\s*/?([A-Z]{2})[-\s]*(\d{1,10})', 'g'))[2]
      || '-'
      || (regexp_matches(conteudo, '([A-ZÁÉÍÓÚÂÊÔÃÕÇ][A-Za-záéíóúâêôãõç\s]+?)\s*[-–—]\s*OAB\s*/?([A-Z]{2})[-\s]*(\d{1,10})', 'g'))[3]
      AS match_text
  ) sub
  WHERE match_text IS NOT NULL
)
WHERE advogados_json IS NULL
  AND conteudo ~ 'OAB\s*/?[A-Z]{2}[-\s]*\d+';