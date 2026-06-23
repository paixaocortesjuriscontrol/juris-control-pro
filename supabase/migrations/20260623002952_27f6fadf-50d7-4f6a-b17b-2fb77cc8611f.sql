DROP INDEX IF EXISTS public.uq_pub_djen_servidor_hash;
DROP INDEX IF EXISTS public.uq_pub_djen_servidor_coord_conteudo_key;
CREATE UNIQUE INDEX IF NOT EXISTS uq_pub_djen_servidor_coord_id_djen
ON public.publicacoes_djen_servidor (coordenacao_id, id_djen)
WHERE id_djen IS NOT NULL AND coordenacao_id IS NOT NULL;