
-- Adicionar "GOL LINHAS AEREAS" às exclusões de todos os termos da coordenação Dr. Thomás
UPDATE monitoramentos_djen
SET exclusoes = array_append(COALESCE(exclusoes, ARRAY[]::text[]), 'GOL LINHAS AEREAS'),
    updated_at = now()
WHERE coordenacao_id = 'b1ff723c-3d0b-40fb-a477-5d2ff2bd7d2f'
  AND NOT ('GOL LINHAS AEREAS' = ANY(COALESCE(exclusoes, ARRAY[]::text[])));
