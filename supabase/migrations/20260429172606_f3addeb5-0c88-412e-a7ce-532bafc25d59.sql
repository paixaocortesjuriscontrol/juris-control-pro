-- Bloco 1: TRTs 10,18,23,24
UPDATE monitoramentos_djen
SET tribunais = ARRAY['TRT10','TRT18','TRT23','TRT24']::text[]
WHERE coordenacao_id = 'f5a0ac48-7461-49c1-9151-219e570831bd'
  AND descricao IN ('GOL - TRTs 10,18,23,24','GOL Adv - TRTs 10,18,23,24','PROTEGE + OSMAR (AND) - TRTs 10,18,23,24','PROFORTE + OSMAR (AND) - TRTs 10,18,23,24');

-- Bloco 2: TRT10 extras
UPDATE monitoramentos_djen
SET tribunais = ARRAY['TRT10']::text[]
WHERE coordenacao_id = 'f5a0ac48-7461-49c1-9151-219e570831bd'
  AND descricao = 'TRT10 - parte adicional';

-- Bloco 3: TRTs 3,4,5,6,7,8,9,11,12,13,14,16,17,19,20,21,22
UPDATE monitoramentos_djen
SET tribunais = ARRAY['TRT3','TRT4','TRT5','TRT6','TRT7','TRT8','TRT9','TRT11','TRT12','TRT13','TRT14','TRT16','TRT17','TRT19','TRT20','TRT21','TRT22']::text[]
WHERE coordenacao_id = 'f5a0ac48-7461-49c1-9151-219e570831bd'
  AND descricao IN ('GOL - TRTs 3,4,5,6,7,8,9,11,12,13,14,16,17,19,20,21,22','GOL Adv - TRTs 3,4,5,6,7,8,9,11,12,13,14,16,17,19,20,21,22');

-- Bloco 4: JOMAGA - TRT17/TRT01
UPDATE monitoramentos_djen
SET tribunais = ARRAY['TRT1','TRT17']::text[]
WHERE coordenacao_id = 'f5a0ac48-7461-49c1-9151-219e570831bd'
  AND descricao = 'JOMAGA - TRT17/TRT01';

-- Bloco 5: TRTs 1,2,15
UPDATE monitoramentos_djen
SET tribunais = ARRAY['TRT1','TRT2','TRT15']::text[]
WHERE coordenacao_id = 'f5a0ac48-7461-49c1-9151-219e570831bd'
  AND descricao = 'GOL Adv - TRTs 1,2,15';