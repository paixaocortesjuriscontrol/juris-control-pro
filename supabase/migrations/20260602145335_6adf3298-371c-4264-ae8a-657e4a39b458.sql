
-- 1) Duplicar membros (ignorar duplicados via ON CONFLICT)
INSERT INTO membros_coordenacao (coordenacao_id, usuario_id, cargo)
SELECT '3e47fc83-3539-4fa7-9fcf-33825120e1b7', usuario_id, cargo
FROM membros_coordenacao
WHERE coordenacao_id = 'b0f690ad-68da-43d7-af5f-9adafeab3fd5'
ON CONFLICT (coordenacao_id, usuario_id) DO NOTHING;

-- 2) Duplicar termos de busca DJEN
INSERT INTO monitoramentos_djen (
  tipo, termo_busca, oab, uf, ativo, criado_por, coordenacao_id,
  exclusoes, condicao_concomitante, tribunais, descricao,
  termos_or, buscar_parte, tribunais_ufs, somente_kurier
)
SELECT
  tipo, termo_busca, oab, uf, ativo, criado_por,
  '3e47fc83-3539-4fa7-9fcf-33825120e1b7',
  exclusoes, condicao_concomitante, tribunais, descricao,
  termos_or, buscar_parte, tribunais_ufs, somente_kurier
FROM monitoramentos_djen
WHERE coordenacao_id = 'b0f690ad-68da-43d7-af5f-9adafeab3fd5';
