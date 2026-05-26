UPDATE public.monitoramentos_djen
SET tribunais = ARRAY['TST','STF','TRT1','TRT2','TRT3','TRT4','TRT5','TRT6','TRT7','TRT8','TRT9','TRT10','TRT11','TRT12','TRT13','TRT14','TRT15','TRT16','TRT17','TRT18','TRT19','TRT20','TRT21','TRT22','TRT23','TRT24']
WHERE coordenacao_id = 'b1ff723c-3d0b-40fb-a477-5d2ff2bd7d2f'
  AND tipo = 'processo'
  AND descricao LIKE 'TST, STF+TODOS TRTs %';