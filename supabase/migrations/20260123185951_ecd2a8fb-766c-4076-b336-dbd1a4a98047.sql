-- Corrigir todas as data_publicacao nas tabelas DJEN
-- Regra: data_publicacao = próximo dia útil após data_disponibilizacao

-- Recalcular publicacoes_djen_processos (tinha erro)
UPDATE publicacoes_djen_processos
SET data_publicacao = proximo_dia_util((data_disponibilizacao::DATE + INTERVAL '1 day')::DATE)
WHERE data_disponibilizacao IS NOT NULL;

-- Recalcular publicacoes_djen (garantir consistência)
UPDATE publicacoes_djen
SET data_publicacao = proximo_dia_util((data_disponibilizacao::DATE + INTERVAL '1 day')::DATE)
WHERE data_disponibilizacao IS NOT NULL;

-- Recalcular publicacoes_djen_descartadas (garantir consistência)
UPDATE publicacoes_djen_descartadas
SET data_publicacao = proximo_dia_util((data_disponibilizacao::DATE + INTERVAL '1 day')::DATE)
WHERE data_disponibilizacao IS NOT NULL;