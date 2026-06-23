DROP INDEX IF EXISTS public.uq_pub_djen_servidor_coord_id_djen;

CREATE UNIQUE INDEX uq_pub_djen_servidor_coord_id_djen
ON public.publicacoes_djen_servidor (coordenacao_id, id_djen);