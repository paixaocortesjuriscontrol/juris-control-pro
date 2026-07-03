
DROP INDEX IF EXISTS public.uq_pub_djen_servidor_coord_id_djen;
CREATE UNIQUE INDEX uq_pub_djen_servidor_coord_mon_id_djen
  ON public.publicacoes_djen_servidor (coordenacao_id, monitoramento_id, id_djen)
  WHERE id_djen IS NOT NULL AND coordenacao_id IS NOT NULL AND monitoramento_id IS NOT NULL;
