-- Fix ALL records where data_publicacao equals data_disponibilizacao
-- publicacoes_djen_processos
UPDATE publicacoes_djen_processos
SET data_publicacao = CASE
  WHEN EXTRACT(DOW FROM (data_disponibilizacao::date + 1)) = 6
    THEN (data_disponibilizacao::date + 3)::timestamptz
  WHEN EXTRACT(DOW FROM (data_disponibilizacao::date + 1)) = 0
    THEN (data_disponibilizacao::date + 2)::timestamptz
  ELSE (data_disponibilizacao::date + 1)::timestamptz
END
WHERE data_disponibilizacao IS NOT NULL
AND data_disponibilizacao::date = data_publicacao::date;

-- publicacoes_djen
UPDATE publicacoes_djen
SET data_publicacao = CASE
  WHEN EXTRACT(DOW FROM (data_disponibilizacao::date + 1)) = 6
    THEN (data_disponibilizacao::date + 3)::timestamptz
  WHEN EXTRACT(DOW FROM (data_disponibilizacao::date + 1)) = 0
    THEN (data_disponibilizacao::date + 2)::timestamptz
  ELSE (data_disponibilizacao::date + 1)::timestamptz
END
WHERE data_disponibilizacao IS NOT NULL
AND data_disponibilizacao::date = data_publicacao::date;