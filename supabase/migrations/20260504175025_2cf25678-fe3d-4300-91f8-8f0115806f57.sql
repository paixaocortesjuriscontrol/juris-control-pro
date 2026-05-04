-- Sincronizar tribunais e adicionar OAB/palavras-chave da "Coordenacão Dra. Janaina" para a "Completa"
-- 1) Adicionar tribunais STF/TRT10/TRT18/TRT23/TRT24/TST garantidos a todos monitoramentos parte da Completa
--    (Completa já cobre todos os tribunais nacionais - skip)

-- 2) Inserir 4 monitoramentos faltantes na Completa (1 OAB + 3 palavras-chave)
INSERT INTO monitoramentos_djen (coordenacao_id, tipo, termo_busca, oab, uf, ativo, tribunais, exclusoes, descricao, buscar_parte, criado_por)
SELECT '9d4e11e2-e81f-45ef-a8d4-977ddf371e18'::uuid, tipo, termo_busca, oab, uf, true, tribunais, exclusoes, descricao, buscar_parte, criado_por
FROM monitoramentos_djen
WHERE coordenacao_id='f73e8ee7-924c-4518-bbdc-62dd77df93a1'
  AND ativo=true
  AND ((tipo='advogado' AND oab='10424' AND uf='DF')
    OR (tipo='palavra-chave' AND termo_busca IN ('CARLOS JOSE ELIAS JUNIOR','CLÍNICA CAMPO GRANDE','CLÍNICA DE CAMPO GRANDE')));