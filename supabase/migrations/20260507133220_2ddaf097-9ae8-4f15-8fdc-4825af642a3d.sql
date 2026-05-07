UPDATE public.monitoramentos_djen
SET descricao = upper(coalesce(tipo, '')) || ' | ' || coalesce(termo_busca, '') || ' | ' || coalesce(array_to_string(tribunais, ', '), '')
WHERE coordenacao_id = '9d4e11e2-e81f-45ef-a8d4-977ddf371e18';