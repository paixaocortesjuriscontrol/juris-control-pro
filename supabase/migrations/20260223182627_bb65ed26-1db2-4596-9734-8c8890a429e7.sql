INSERT INTO monitoramentos_djen (termo_busca, tipo, oab, uf, descricao, tribunais, ativo, condicao_concomitante, termos_or, coordenacao_id, criado_por)
SELECT 
  termo_busca, tipo, oab, uf, descricao, tribunais, ativo, condicao_concomitante, termos_or,
  'b6a3a750-3109-4962-bea9-7b5116e3a4fd'::uuid,
  'a318c5eb-c2cc-480a-952a-5c2a42b85fc6'::uuid
FROM monitoramentos_djen
WHERE coordenacao_id = '3e47fc83-3539-4fa7-9fcf-33825120e1b7';