-- Apagar publicações DJEN de processos com datas nulas
DELETE FROM publicacoes_djen_processos 
WHERE data_publicacao IS NULL 
  AND data_disponibilizacao IS NULL;